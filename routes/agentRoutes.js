const express = require("express");
const { ethers } = require("ethers");
const { verifyX402Payment } = require("../middleware/x402Middleware");
const { listAgents, getAgent, filterAgentsByCapability } = require("../services/registryService");
const { resolveAgentEndpoint } = require("../services/agentInteractionEngine");
const { verifyGoatX402Payment } = require("../services/x402Service");
const { payAgent, verifyOnchainPayment } = require("../services/paymentContractService");
const { requireUsdcX402Payment } = require("../middleware/x402UsdcMiddleware");

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

    const expectedWei = String(expectedAmountWei || "0");
    const x402Result = await verifyGoatX402Payment(txHash, expectedWei);

    const endpointUnavailable =
      !x402Result.valid &&
      /status 404/i.test(String(x402Result.reason || "")) &&
      /cannot post/i.test(String(x402Result.response || ""));

    let result = x402Result;
    if (endpointUnavailable) {
      const onchain = await verifyOnchainPayment(txHash, expectedWei);
      result = onchain.valid
        ? {
            ...onchain,
            verificationMode: "onchain_fallback",
            x402Available: false,
            reason: "x402 txHash verification endpoint unavailable; on-chain verification passed"
          }
        : {
            ...x402Result,
            verificationMode: "onchain_fallback_failed",
            onchain
          };
    }

    upsertTransaction({
      txHash,
      amountWei: result.amountWei || expectedWei,
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

async function aiPlanHandler(req, res) {
  try {
    const goal = String(req.query.goal || "Build and launch a resilient AI workflow");
    const constraints = String(req.query.constraints || "budget, latency, reliability");
    const plan = [
      {
        step: 1,
        name: "Discover Inputs",
        details: `Gather context and requirements for: ${goal}`
      },
      {
        step: 2,
        name: "Generate Strategy",
        details: "Select model routing, tool usage, and error budgets"
      },
      {
        step: 3,
        name: "Execute Workflow",
        details: `Run execution pipeline while enforcing constraints: ${constraints}`
      },
      {
        step: 4,
        name: "Validate Output",
        details: "Perform quality checks, guardrails, and rollback criteria"
      }
    ];

    return res.json({
      ok: true,
      tool: "ai-plan",
      plan,
      paymentVerified: {
        protocol: "x402",
        txHash: req.paymentInfo.txHash,
        chain: req.paymentInfo.chain,
        chainId: req.paymentInfo.chainId,
        token: req.paymentInfo.token,
        amount: req.paymentInfo.amountFormatted,
        receiver: req.paymentInfo.receiver
      }
    });
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
router.get("/ai-plan", requireUsdcX402Payment(), aiPlanHandler);

module.exports = router;
