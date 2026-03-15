const { ethers } = require("ethers");

const ERC20_ABI = [
  "event Transfer(address indexed from,address indexed to,uint256 value)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];

const CHAIN_CONFIG = {
  48816: {
    chainId: 48816,
    chain: "GOAT Testnet3",
    rpcUrl: process.env.GOAT_TESTNET3_RPC_URL || process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network",
    usdcAddress: (
      process.env.GOAT_TESTNET3_USDC_ADDRESS ||
      process.env.ERC8004_REGISTRY_ADDRESS ||
      "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1"
    ).toLowerCase()
  }
};

const usedPaymentTx = new Map();
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MAX_TX_AGE_MS = 24 * 60 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, value] of usedPaymentTx.entries()) {
    if (now - value.usedAt > MAX_TX_AGE_MS) {
      usedPaymentTx.delete(key);
    }
  }
}, CLEANUP_INTERVAL_MS).unref();

function getRequestedChain(chainIdHeader) {
  const fallback = Number(process.env.X402_PREFERRED_CHAIN_ID || 48816);
  const chainId = Number(chainIdHeader || fallback);
  return CHAIN_CONFIG[chainId];
}

function getRequirementPayload(chainConfig) {
  return {
    amount: String(process.env.X402_USDC_AMOUNT || "0.001"),
    token: "USDC",
    chain: chainConfig.chain,
    chainId: chainConfig.chainId,
    address: process.env.X402_RECEIVER_WALLET || "",
    tokenContract: chainConfig.usdcAddress
  };
}

function normalizeAddress(value) {
  try {
    return ethers.getAddress(String(value || ""));
  } catch {
    return "";
  }
}

async function verifyUsdcPayment(params) {
  const chainConfig = getRequestedChain(params.chainId);
  if (!chainConfig) {
    return {
      valid: false,
      reason: "Unsupported chain",
      details: { chainId: params.chainId }
    };
  }

  const txHash = String(params.txHash || "").trim();
  if (!txHash) {
    return { valid: false, reason: "Missing X-PAYMENT-TX header" };
  }

  const receiver = normalizeAddress(process.env.X402_RECEIVER_WALLET);
  if (!receiver) {
    return { valid: false, reason: "X402_RECEIVER_WALLET is not configured" };
  }

  const txKey = `${chainConfig.chainId}:${txHash.toLowerCase()}`;
  if (usedPaymentTx.has(txKey)) {
    return { valid: false, reason: "Replay transaction detected" };
  }

  const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl, chainConfig.chainId);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== chainConfig.chainId) {
    return {
      valid: false,
      reason: "RPC chain mismatch",
      details: { expected: chainConfig.chainId, got: Number(network.chainId) }
    };
  }

  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    return { valid: false, reason: "Transaction not found" };
  }

  if (receipt.status !== 1) {
    return { valid: false, reason: "Transaction failed" };
  }

  if (receipt.confirmations < Number(process.env.X402_MIN_CONFIRMATIONS || 1)) {
    return { valid: false, reason: "Transaction not confirmed enough" };
  }

  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    return { valid: false, reason: "Unable to fetch transaction" };
  }

  const payerHeader = normalizeAddress(params.payerAddress);
  const txFrom = normalizeAddress(tx.from);
  if (payerHeader && txFrom && payerHeader !== txFrom) {
    return {
      valid: false,
      reason: "Payer mismatch",
      details: { expectedPayer: payerHeader, txFrom }
    };
  }

  const tokenAddress = normalizeAddress(chainConfig.usdcAddress);
  const iface = new ethers.Interface(ERC20_ABI);
  const expectedAmount = ethers.parseUnits(String(process.env.X402_USDC_AMOUNT || "0.001"), 6);

  let matchedTransfer = null;
  for (const log of receipt.logs) {
    if (normalizeAddress(log.address) !== tokenAddress) {
      continue;
    }

    let parsed;
    try {
      parsed = iface.parseLog(log);
    } catch {
      continue;
    }

    if (!parsed || parsed.name !== "Transfer") {
      continue;
    }

    const from = normalizeAddress(parsed.args.from);
    const to = normalizeAddress(parsed.args.to);
    const value = BigInt(parsed.args.value.toString());

    if (to !== receiver) {
      continue;
    }

    if (payerHeader && from !== payerHeader) {
      continue;
    }

    if (value < expectedAmount) {
      continue;
    }

    matchedTransfer = { from, to, value };
    break;
  }

  if (!matchedTransfer) {
    const allowNativeFallback = String(process.env.X402_ALLOW_NATIVE_FALLBACK || "true").toLowerCase() === "true";
    if (allowNativeFallback) {
      const nativeExpected = BigInt(process.env.X402_NATIVE_FALLBACK_WEI || "10000000000000");
      const nativeTarget = normalizeAddress(
        process.env.X402_NATIVE_RECEIVER || process.env.AGENT_SERVICE_PAYMENT_ADDRESS || process.env.X402_RECEIVER_WALLET
      );

      const txTo = normalizeAddress(tx.to);
      const txValue = BigInt(tx.value || 0n);
      if (nativeTarget && txTo === nativeTarget && txValue >= nativeExpected) {
        usedPaymentTx.set(txKey, { usedAt: Date.now() });
        return {
          valid: true,
          txHash,
          chainId: chainConfig.chainId,
          chain: chainConfig.chain,
          token: "NATIVE",
          tokenContract: "",
          amount: txValue.toString(),
          amountFormatted: ethers.formatEther(txValue),
          payer: txFrom,
          receiver: txTo,
          blockNumber: receipt.blockNumber,
          confirmations: receipt.confirmations,
          verificationMode: "native_fallback"
        };
      }
    }

    return {
      valid: false,
      reason: "No valid USDC transfer found",
      details: {
        tokenContract: tokenAddress,
        receiver,
        minAmount: expectedAmount.toString()
      }
    };
  }

  usedPaymentTx.set(txKey, { usedAt: Date.now() });

  return {
    valid: true,
    txHash,
    chainId: chainConfig.chainId,
    chain: chainConfig.chain,
    token: "USDC",
    tokenContract: tokenAddress,
    amount: matchedTransfer.value.toString(),
    amountFormatted: ethers.formatUnits(matchedTransfer.value, 6),
    payer: matchedTransfer.from,
    receiver: matchedTransfer.to,
    blockNumber: receipt.blockNumber,
    confirmations: receipt.confirmations
  };
}

module.exports = {
  getRequirementPayload,
  verifyUsdcPayment,
  getRequestedChain
};
