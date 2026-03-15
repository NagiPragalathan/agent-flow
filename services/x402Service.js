const crypto = require("crypto");

function getRequiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

async function verifyGoatX402Payment(txHash, expectedAmountWei) {
  if (!txHash) {
    return { valid: false, reason: "Missing transaction hash" };
  }

  const baseUrl = getRequiredEnv("GOATX402_API_URL");
  const merchantId = getRequiredEnv("GOATX402_MERCHANT_ID");
  const apiKey = getRequiredEnv("GOATX402_API_KEY");
  const apiSecret = getRequiredEnv("GOATX402_API_SECRET");

  const timestamp = new Date().toISOString();
  const payload = `${merchantId}:${txHash}:${timestamp}`;
  const signature = signPayload(payload, apiSecret);

  const response = await fetch(baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Merchant-ID": merchantId,
      "X-API-Key": apiKey,
      "X-Signature": signature,
      "X-Timestamp": timestamp
    },
    body: JSON.stringify({
      transactionHash: txHash
    })
  });

  if (!response.ok) {
    return {
      valid: false,
      reason: `x402 verification failed with status ${response.status}`
    };
  }

  const data = await response.json();
  const status = String(data.status || "").toLowerCase();
  const verifiedMerchant = data.merchantId || data.merchant_id;
  const amountPaid = BigInt(data.amountWei || data.amount || 0);
  const expectedAmount = BigInt(expectedAmountWei || 0);

  if (status !== "confirmed" && status !== "success") {
    return { valid: false, reason: "Transaction not confirmed", details: data };
  }

  if (String(verifiedMerchant) !== merchantId) {
    return { valid: false, reason: "Merchant mismatch", details: data };
  }

  if (amountPaid < expectedAmount) {
    return { valid: false, reason: "Amount too low", details: data };
  }

  const paidTo = data.to || data.receiver || data.payee;

  return {
    valid: true,
    txHash,
    status,
    merchantId: verifiedMerchant,
    amountWei: amountPaid.toString(),
    paidTo,
    raw: data
  };
}

module.exports = {
  verifyGoatX402Payment
};
