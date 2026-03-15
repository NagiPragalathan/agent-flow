const crypto = require("crypto");

const HARDCODED_X402 = {
  baseUrl: "https://x402-api-lx58aabp0r.testnet3.goat.network",
  merchantId: "A402",
  apiKey: "VrNYqLMyPW7147y7TTkrZp6iqC2hI_gYGvabDWqLGAs=",
  apiSecret: "97ux71GcPyDGGtXdg3576r5W2P2ZZZYbEOiNf4DfclU="
};

function signPayload(payload, secret) {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

function buildSignSource(body, apiKey, timestamp, nonce) {
  const data = {
    ...(body || {}),
    api_key: apiKey,
    timestamp,
    nonce
  };

  return Object.keys(data)
    .filter((key) => key !== "sign" && data[key] !== "" && data[key] !== null && data[key] !== undefined)
    .sort((a, b) => a.localeCompare(b, "en", { sensitivity: "base" }))
    .map((key) => `${key}=${String(data[key])}`)
    .join("&");
}

function buildCandidateUrls(inputUrl) {
  const url = String(inputUrl || "").replace(/\/$/, "");
  if (/\/api\/v1\/(payments\/)?verify$/i.test(url)) {
    return [url];
  }

  return [
    `${url}/api/v1/verify`,
    `${url}/api/v1/payments/verify`,
    `${url}/verify`,
    `${url}/v1/verify`
  ];
}

async function verifyGoatX402Payment(txHash, expectedAmountWei) {
  if (!txHash) {
    return { valid: false, reason: "Missing transaction hash" };
  }

  try {
    const baseUrl = HARDCODED_X402.baseUrl;
    const merchantId = HARDCODED_X402.merchantId;
    const apiKey = HARDCODED_X402.apiKey;
    const apiSecret = HARDCODED_X402.apiSecret;

    const requestBody = {
      transactionHash: txHash
    };

    const candidateUrls = buildCandidateUrls(baseUrl);
    let data;
    let lastStatus = 0;
    let lastBody = "";
    let finalUrl = "";

    for (const url of candidateUrls) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const nonce = crypto.randomUUID();
      const signSource = buildSignSource(requestBody, apiKey, timestamp, nonce);
      const signature = signPayload(signSource, apiSecret);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Merchant-ID": merchantId,
            "X-API-Key": apiKey,
            "X-Sign": signature,
            "X-Signature": signature,
            "X-Timestamp": timestamp,
            "X-Nonce": nonce
          },
          body: JSON.stringify(requestBody)
        });

        finalUrl = url;
        lastStatus = response.status;
        lastBody = await response.text();

        if (response.ok) {
          try {
            data = lastBody ? JSON.parse(lastBody) : {};
          } catch {
            data = {};
          }
          break;
        }

        if (response.status !== 404) {
          return {
            valid: false,
            reason: `x402 verification failed with status ${response.status}`,
            endpoint: url,
            response: lastBody
          };
        }
      } catch (error) {
        finalUrl = url;
        lastStatus = 0;
        lastBody = error instanceof Error ? error.message : String(error);
      }
    }

    if (!data) {
      return {
        valid: false,
        reason: `x402 verification failed with status ${lastStatus || 404}`,
        endpoint: finalUrl || baseUrl,
        response: lastBody
      };
    }

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
      endpoint: finalUrl,
      status,
      merchantId: verifiedMerchant,
      amountWei: amountPaid.toString(),
      paidTo,
      raw: data
    };
  } catch (error) {
    return {
      valid: false,
      reason: "x402 verification processing error",
      response: error instanceof Error ? error.message : String(error)
    };
  }
}

module.exports = {
  verifyGoatX402Payment
};
