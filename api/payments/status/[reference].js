import { mapPaymentIntentStatus, paymongoKeyMode, retrievePaymentIntent } from "../../_lib/paymongo.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  const reference = req.query?.reference;
  const paymentIntentId =
    typeof req.query?.paymentIntentId === "string" && req.query.paymentIntentId.trim()
      ? req.query.paymentIntentId.trim()
      : "";

  if (!paymentIntentId) {
    return res.status(400).json({
      message: "paymentIntentId is required to verify status in serverless mode.",
      hint: "Create a payment session first and pass paymentIntentId when polling status.",
    });
  }

  try {
    const paymentIntent = await retrievePaymentIntent(paymentIntentId);
    const attributes = paymentIntent?.data?.attributes || {};
    const paymentIntentStatus = attributes.status || null;

    return res.status(200).json({
      reference: typeof reference === "string" ? reference : "",
      paymentIntentId,
      status: mapPaymentIntentStatus(paymentIntentStatus),
      paymongoKeyMode,
      paymentIntentStatus,
      paymentIntentNextAction: attributes.next_action || null,
      paymentIntentLastPaymentError: attributes.last_payment_error || null,
      paymentIntentPayments: attributes.payments?.data || [],
      paymentIntentPaidAt: attributes.paid_at || null,
      paymentIntentUpdatedAt: attributes.updated_at || null,
    });
  } catch (error) {
    return res.status(502).json({
      message: error?.message || "Unable to verify payment status.",
      hint: "Check PAYMONGO_SECRET_KEY and PayMongo API availability.",
    });
  }
}
