import {
  computeAmountFromCart,
  createBillingFromRequest,
  generateReference,
  mapPaymentIntentStatus,
  normalizeAmountToCentavos,
  paymongoKeyMode,
  paymongoSecretKey,
  requestPaymongo,
} from "../_lib/paymongo.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed." });
  }

  const reference =
    typeof req.body?.reference === "string" && req.body.reference.trim()
      ? req.body.reference.trim()
      : generateReference();
  const description =
    typeof req.body?.description === "string" && req.body.description.trim()
      ? req.body.description.trim()
      : `Originals Printing order ${reference}`;

  const cartAmount = computeAmountFromCart(req.body?.cart);
  const requestedAmount = Number(req.body?.amount);
  const amount = cartAmount > 0 ? cartAmount : requestedAmount;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number or computable from cart items." });
  }

  if (!paymongoSecretKey) {
    return res.status(500).json({
      message: "PAYMONGO_SECRET_KEY is missing.",
      hint: "Set PAYMONGO_SECRET_KEY in Vercel Project Settings > Environment Variables.",
    });
  }

  const amountInCentavos = normalizeAmountToCentavos(amount);
  if (amountInCentavos < 100) {
    return res.status(400).json({
      message: "Minimum PayMongo charge is PHP 1.00. Increase your order total to continue.",
      hint: "Your current total is below PayMongo's minimum amount requirement.",
    });
  }

  const billing = createBillingFromRequest(req.body);

  try {
    const paymentIntent = await requestPaymongo("/payment_intents", {
      data: {
        attributes: {
          amount: amountInCentavos,
          currency: "PHP",
          payment_method_allowed: ["qrph"],
          description,
          statement_descriptor: "ORIGINALS",
          metadata: {
            reference,
            source: "checkout",
          },
        },
      },
    });

    const paymentIntentId = paymentIntent?.data?.id;
    if (!paymentIntentId) {
      throw new Error("PayMongo did not return a payment intent id.");
    }

    const paymentMethod = await requestPaymongo("/payment_methods", {
      data: {
        attributes: {
          type: "qrph",
          billing,
        },
      },
    });

    const paymentMethodId = paymentMethod?.data?.id;
    if (!paymentMethodId) {
      throw new Error("PayMongo did not return a payment method id.");
    }

    const attachedPaymentIntent = await requestPaymongo(`/payment_intents/${paymentIntentId}/attach`, {
      data: {
        attributes: {
          payment_method: paymentMethodId,
        },
      },
    });

    const attributes = attachedPaymentIntent?.data?.attributes || {};
    const qrImageUrl = attributes?.next_action?.code?.image_url || "";
    const expiresAt = Date.now() + 30 * 60 * 1000;

    return res.status(200).json({
      reference,
      amount,
      amountInCentavos,
      currency: "PHP",
      paymongoKeyMode,
      paymentIntentId,
      paymentMethodId,
      qrImageUrl,
      checkoutUrl: qrImageUrl,
      status: mapPaymentIntentStatus(attributes.status),
      expiresAt,
    });
  } catch (error) {
    const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
    return res.status(statusCode).json({
      message: error?.message || "Unable to create payment session.",
      hint: "Check PAYMONGO_SECRET_KEY in Vercel and verify PayMongo account configuration.",
    });
  }
}
