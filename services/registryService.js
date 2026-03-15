const { ethers } = require("ethers");

const REGISTRY_ABI = [
  "function listAgents() view returns (tuple(string agentName,string description,string[] capabilities,string apiEndpoint,address ownerWallet)[])",
  "function getAgent(uint256 agentId) view returns (tuple(string agentName,string description,string[] capabilities,string apiEndpoint,address ownerWallet))",
  "function filterAgentsByCapability(string capability) view returns (tuple(string agentName,string description,string[] capabilities,string apiEndpoint,address ownerWallet)[])"
];

const provider = new ethers.JsonRpcProvider(
  process.env.GOAT_RPC_URL || "https://rpc3.testnet.goat.network",
  Number(process.env.GOAT_CHAIN_ID || 48816)
);

const registryAddress =
  process.env.ERC8004_REGISTRY_ADDRESS || "0x29d1ee93e9ecf6e50f309f498e40a6b42d352fa1";

const registryContract = new ethers.Contract(registryAddress, REGISTRY_ABI, provider);

function normalizeAgent(agent, fallbackId) {
  return {
    agentId: fallbackId,
    agentName: agent.agentName,
    description: agent.description,
    capabilities: Array.isArray(agent.capabilities) ? agent.capabilities : [],
    apiEndpoint: agent.apiEndpoint,
    ownerWallet: agent.ownerWallet
  };
}

async function listAgents() {
  const agents = await registryContract.listAgents();
  return agents.map((agent, index) => normalizeAgent(agent, index));
}

async function getAgent(agentId) {
  const agent = await registryContract.getAgent(agentId);
  return normalizeAgent(agent, Number(agentId));
}

async function filterAgentsByCapability(capability) {
  if (!capability || typeof capability !== "string") {
    throw new Error("capability is required");
  }

  try {
    const agents = await registryContract.filterAgentsByCapability(capability);
    return agents.map((agent, index) => normalizeAgent(agent, index));
  } catch (error) {
    const allAgents = await listAgents();
    const normalizedCapability = capability.toLowerCase();
    return allAgents.filter((agent) =>
      agent.capabilities.some((entry) => String(entry).toLowerCase() === normalizedCapability)
    );
  }
}

module.exports = {
  listAgents,
  getAgent,
  filterAgentsByCapability
};
