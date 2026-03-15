const { getAgent } = require("./registryService");

async function resolveAgentEndpoint(agentId) {
  const agent = await getAgent(agentId);
  if (!agent?.apiEndpoint) {
    throw new Error("Target agent endpoint not found");
  }
  return agent;
}

module.exports = {
  resolveAgentEndpoint
};
