const express = require("express");
const { ethers } = require("ethers");
const { verifyX402Payment } = require("../middleware/x402Middleware");
const { listAgents, getAgent, filterAgentsByCapability } = require("../services/registryService");
const { resolveAgentEndpoint } = require("../services/agentInteractionEngine");
const { verifyGoatX402Payment } = require("../services/x402Service");
const { payAgent } = require("../services/paymentContractService");

const router = express.Router();
const paymentHistory = [];

function upsertTransaction(entry) {
  const index = paymentHistory.findIndex((tx) => tx.txHash === entry.txHash);
  if (index >= 0) {
    paymentHistory[index] = { ...paymentHistory[index], ...entry };
    return;
  }
  paymentHistory.unshift(entry);
}

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
      source: "x402-execute",
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

    const registryAddress = String(process.env.ERC8004_REGISTRY_ADDRESS || "").toLowerCase();
    if (String(agentAddress).toLowerCase() === registryAddress) {
      return res.status(400).json({
        error: "Invalid agentAddress for payment",
        message: "Do not use registry contract address as receiver. Use agent owner wallet (EOA) or payable contract address."
      });
    }

    const payment = await payAgent({
      agentAddress,
      serviceName: serviceName || "market_analysis",
      amountEth: amountEth || "0.0001"
    });

    upsertTransaction({
      txHash: payment.chainTxHash,
      amountWei: ethers.parseEther(String(amountEth || "0.0001")).toString(),
      status: "onchain_success",
      merchantId: process.env.GOATX402_MERCHANT_ID || "",
      agentId: null,
      task: serviceName || "market_analysis",
      source: "agent-to-agent",
      timestamp: new Date().toISOString(),
      paidTo: agentAddress
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
    upsertTransaction({
      txHash,
      amountWei: result.amountWei || String(expectedAmountWei || "0"),
      status: result.valid ? "x402_verified" : "x402_failed",
      merchantId: result.merchantId || process.env.GOATX402_MERCHANT_ID || "",
      agentId: null,
      task: "x402_verify",
      source: "x402-feed",
      timestamp: new Date().toISOString(),
      verifyReason: result.reason || ""
    });

    const statusCode = result.valid ? 200 : 402;
    return res.status(statusCode).json({ result });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}

router.get("/agents", listAgentsHandler);
router.get("/agents/:id", getAgentHandler);
router.get("/agents/capability/:capability", filterAgentsByCapabilityHandler);

router.post("/agent/request", requestAgentService);
router.post("/agent/execute", verifyX402Payment("1"), executePaidAgentService);
router.get("/agent/payment-status/:txHash", paymentStatus);
router.get("/transactions", transactionHistory);
router.get("/demo/agents", listDemoAgents);
router.post("/demo/agent-payment", demoAgentPayment);
router.post("/demo/x402-verify", demoVerifyX402);

module.exports = router;
