const {
  getRequirementPayload,
  verifyUsdcPayment,
  getRequestedChain
} = require("../services/usdcX402Verifier");

function requireUsdcX402Payment() {
  return async (req, res, next) => {
    try {
      const txHash = req.header("x-payment-tx") || req.header("X-PAYMENT-TX") || "";
      const chainId = req.header("x-payment-chain-id") || req.header("X-PAYMENT-CHAIN-ID") || "";
      const payerAddress = req.header("x-payer-address") || req.header("X-PAYER-ADDRESS") || "";

      const chainConfig = getRequestedChain(chainId);
      if (!chainConfig) {
        return res.status(400).json({
          error: "Unsupported chain",
          supportedChains: [48816]
        });
      }

      if (!txHash) {
        return res.status(402).json({
          error: "Payment Required",
          ...getRequirementPayload(chainConfig)
        });
      }

      const verification = await verifyUsdcPayment({ txHash, chainId, payerAddress });
      if (!verification.valid) {
        return res.status(402).json({
          error: "Payment Required",
          ...getRequirementPayload(chainConfig),
          reason: verification.reason,
          details: verification.details || null
        });
      }

      req.paymentInfo = verification;
      return next();
    } catch (error) {
      return res.status(500).json({
        error: "x402 payment verification error",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  };
}

module.exports = {
  requireUsdcX402Payment
};
