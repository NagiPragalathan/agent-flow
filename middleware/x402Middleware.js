const { verifyGoatX402Payment } = require("../services/x402Service");

function verifyX402Payment(minAmountWei = "0") {
  return async (req, res, next) => {
    try {
      const txHash = req.header("x402-payment-tx");

      if (!txHash) {
        return res.status(402).json({
          error: "Payment required",
          message: "Missing x402-payment-tx header",
          minAmountWei: String(minAmountWei)
        });
      }

      const result = await verifyGoatX402Payment(txHash, minAmountWei);
      if (!result.valid) {
        return res.status(402).json({
          error: "Payment verification failed",
          reason: result.reason || "Unknown reason"
        });
      }

      req.paymentInfo = result;
      return next();
    } catch (error) {
      return res.status(500).json({
        error: "Payment verification error",
        details: error.message
      });
    }
  };
}

module.exports = {
  verifyX402Payment
};
