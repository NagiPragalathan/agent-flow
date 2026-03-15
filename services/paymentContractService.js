const { ethers } = require("ethers");

const PAYMENT_ABI = [
  "function payForService(address agentAddress, bytes32 serviceId) payable returns (bytes32)",
  "event ServicePaid(bytes32 indexed txHash,address indexed payer,address indexed agent,bytes32 serviceId,uint256 amount,uint256 timestamp)"
];

function getProvider() {
  return new ethers.JsonRpcProvider(
    process.env.GOAT_RPC_URL || "https://rpc.testnet3.goat.network",
    Number(process.env.GOAT_CHAIN_ID || 48816)
  );
}

function getSigner() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error("DEPLOYER_PRIVATE_KEY is required for demo on-chain payment");
  }

  return new ethers.Wallet(privateKey, getProvider());
}

function getContract(signerOrProvider) {
  const address = process.env.AGENT_SERVICE_PAYMENT_ADDRESS;
  if (!address) {
    throw new Error("AGENT_SERVICE_PAYMENT_ADDRESS is required");
  }
  return new ethers.Contract(address, PAYMENT_ABI, signerOrProvider);
}

function encodeServiceId(serviceName) {
  const data = ethers.toUtf8Bytes(String(serviceName || "service"));
  const hex = ethers.hexlify(data).replace("0x", "");
  return `0x${hex.padEnd(64, "0").slice(0, 64)}`;
}

async function payAgent({ agentAddress, serviceName, amountEth }) {
  const signer = getSigner();
  const contract = getContract(signer);
  const serviceId = encodeServiceId(serviceName);

  const tx = await contract.payForService(agentAddress, serviceId, {
    value: ethers.parseEther(String(amountEth || "0.0001"))
  });

  const receipt = await tx.wait();

  return {
    chainTxHash: receipt.hash,
    blockNumber: receipt.blockNumber,
    payer: await signer.getAddress(),
    agentAddress,
    serviceId
  };
}

async function verifyOnchainPayment(txHash, expectedAmountWei) {
  if (!txHash) {
    return { valid: false, reason: "Missing transaction hash" };
  }

  const provider = getProvider();
  const receipt = await provider.getTransactionReceipt(txHash);
  if (!receipt) {
    return { valid: false, reason: "Transaction not found" };
  }

  if (receipt.status !== 1) {
    return { valid: false, reason: "Transaction failed on-chain" };
  }

  const tx = await provider.getTransaction(txHash);
  if (!tx) {
    return { valid: false, reason: "Transaction details unavailable" };
  }

  const paidTo = tx.to || "";
  const expectedTo = String(process.env.AGENT_SERVICE_PAYMENT_ADDRESS || "").toLowerCase();
  if (expectedTo && String(paidTo).toLowerCase() !== expectedTo) {
    return {
      valid: false,
      reason: "Transaction target mismatch",
      paidTo,
      expectedTo
    };
  }

  const paidAmount = tx.value || 0n;
  const expectedAmount = BigInt(expectedAmountWei || "0");
  if (paidAmount < expectedAmount) {
    return {
      valid: false,
      reason: "Amount too low",
      amountWei: paidAmount.toString(),
      expectedAmountWei: expectedAmount.toString()
    };
  }

  return {
    valid: true,
    txHash,
    blockNumber: receipt.blockNumber,
    amountWei: paidAmount.toString(),
    paidTo,
    status: "confirmed"
  };
}

module.exports = {
  payAgent,
  verifyOnchainPayment
};
