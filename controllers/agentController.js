const { listAgents, getAgent, filterAgentsByCapability } = require("../services/registryService");
const { resolveAgentEndpoint } = require("../services/agentInteractionEngine");
const { verifyGoatX402Payment } = require("../services/x402Service");
const { payAgent } = require("../services/paymentContractService");

const paymentHistory = [];

function parseForwardResponse(responseBody) {
  if (!responseBody) return {};

  try {
    return JSON.parse(responseBody);
  } catch {
    return { raw: responseBody };
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function listAgentsHandler(req, res) {
  try {
    const agents = await listAgents();
    return res.json({ agents });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function getAgentHandler(req, res) {
  try {
    const agent = await getAgent(req.params.id);
    return res.json({ agent });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function filterAgentsByCapabilityHandler(req, res) {
  try {
    const agents = await filterAgentsByCapability(req.params.capability);
    return res.json({ agents });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function requestAgentService(req, res) {
  try {
    const { agentId, task, params, requestingAgent } = req.body;

    if (agentId === undefined || !task || !requestingAgent) {
      return res.status(400).json({ error: "agentId, task and requestingAgent are required" });
    }

    const agent = await resolveAgentEndpoint(agentId);

    const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
    const response = await fetchWithTimeout(
      `${agent.apiEndpoint.replace(/\/$/, "")}/agent/request`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task, params, requestingAgentWallet: requestingAgent })
      },
      timeoutMs
    );

    const responseBody = await response.text();

    return res.status(response.status).json({
      forwardedTo: agent.apiEndpoint,
      response: parseForwardResponse(responseBody)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function executePaidAgentService(req, res) {
  try {
    const { agentId, task, params, requestingAgent } = req.body;

    if (agentId === undefined || !task || !requestingAgent) {
      return res.status(400).json({ error: "agentId, task and requestingAgent are required" });
    }

    const agent = await resolveAgentEndpoint(agentId);

    const timeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 15000);
    const response = await fetchWithTimeout(
      `${agent.apiEndpoint.replace(/\/$/, "")}/agent/execute`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x402-payment-tx": req.header("x402-payment-tx") || ""
        },
        body: JSON.stringify({ task, params, requestingAgentWallet: requestingAgent })
      },
      timeoutMs
    );

    const responseBody = await response.text();

    paymentHistory.unshift({
      txHash: req.paymentInfo.txHash,
      amountWei: req.paymentInfo.amountWei,
      status: req.paymentInfo.status,
      merchantId: req.paymentInfo.merchantId,
      agentId,
      task,
      timestamp: new Date().toISOString()
    });

    return res.status(response.status).json({
      payment: req.paymentInfo,
      forwardedTo: agent.apiEndpoint,
      response: parseForwardResponse(responseBody)
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function paymentStatus(req, res) {
  const txHash = req.params.txHash;
  const tx = paymentHistory.find((entry) => entry.txHash === txHash);

  if (!tx) {
    return res.status(404).json({ error: "Transaction not found" });
  }

  return res.json({ transaction: tx });
}

async function transactionHistory(req, res) {
  return res.json({ transactions: paymentHistory });
}

async function listDemoAgents(req, res) {
  try {
    const raw = process.env.DEMO_AGENTS_JSON || "[]";
    const agents = JSON.parse(raw);
    return res.json({ agents });
  } catch (error) {
    return res.status(500).json({ error: "Invalid DEMO_AGENTS_JSON", details: error.message });
  }
}

async function demoAgentPayment(req, res) {
  try {
    const { agentAddress, serviceName, amountEth } = req.body;
    if (!agentAddress) {
      return res.status(400).json({ error: "agentAddress is required" });
    }

    const payment = await payAgent({
      agentAddress,
      serviceName: serviceName || "market_analysis",
      amountEth: amountEth || "0.0001"
    });

    return res.json({ payment });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

async function demoVerifyX402(req, res) {
  try {
    const { txHash, expectedAmountWei } = req.body;
    if (!txHash) {
      return res.status(400).json({ error: "txHash is required" });
    }

    const result = await verifyGoatX402Payment(txHash, expectedAmountWei || "0");
    const statusCode = result.valid ? 200 : 402;
    return res.status(statusCode).json({ result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

module.exports = {
  listAgentsHandler,
  getAgentHandler,
  filterAgentsByCapabilityHandler,
  requestAgentService,
  executePaidAgentService,
  paymentStatus,
  transactionHistory,
  listDemoAgents,
  demoAgentPayment,
  demoVerifyX402
};
