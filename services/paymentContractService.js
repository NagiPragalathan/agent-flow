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

module.exports = {
  payAgent
};
