const paymongoBaseUrl = "https://api.paymongo.com/v1";

export const paymongoSecretKey = process.env.PAYMONGO_SECRET_KEY?.trim();
export const paymongoKeyMode = paymongoSecretKey?.startsWith("sk_live_")
  ? "live"
  : paymongoSecretKey?.startsWith("sk_test_")
    ? "test"
    : "unknown";

const createAuthorizationHeader = () => {
  if (!paymongoSecretKey) {
    return "";
  }

  return `Basic ${Buffer.from(`${paymongoSecretKey}:`).toString("base64")}`;
};

const parsePaymongoError = async (response) => {
  try {
    const payload = await response.json();
    const details = payload?.errors?.[0]?.detail || payload?.errors?.[0]?.message || payload?.message;
    return details || `PayMongo request failed with HTTP ${response.status}`;
  } catch {
    return `PayMongo request failed with HTTP ${response.status}`;
  }
};

export const requestPaymongo = async (path, body) => {
  if (!paymongoSecretKey) {
    throw new Error("PAYMONGO_SECRET_KEY is missing. Add it to Vercel environment variables.");
  }

  const response = await fetch(`${paymongoBaseUrl}${path}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: createAuthorizationHeader(),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = new Error(await parsePaymongoError(response));
    error.statusCode = response.status >= 500 ? 502 : 400;
    throw error;
  }

  return response.json();
};

export const retrievePaymentIntent = async (paymentIntentId) => {
  if (!paymongoSecretKey) {
    throw new Error("PAYMONGO_SECRET_KEY is missing. Add it to Vercel environment variables.");
  }

  const response = await fetch(`${paymongoBaseUrl}/payment_intents/${paymentIntentId}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      authorization: createAuthorizationHeader(),
    },
  });

  if (!response.ok) {
    throw new Error(await parsePaymongoError(response));
  }

  return response.json();
};

export const normalizeAmountToCentavos = (amount) => Math.max(1, Math.round(Number(amount) * 100));

export const computeAmountFromCart = (cartItems) => {
  if (!Array.isArray(cartItems) || cartItems.length === 0) {
    return 0;
  }

  return cartItems.reduce((sum, item) => {
    const quantity = Math.max(1, Math.floor(Number(item?.quantity) || 1));
    const unitPrice = Number(item?.itemPrice ?? item?.product?.price ?? 0);

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return sum;
    }

    return sum + unitPrice * quantity;
  }, 0);
};

export const mapPaymentIntentStatus = (status) => {
  if (status === "succeeded" || status === "paid") {
    return "paid";
  }

  if (status === "expired" || status === "canceled") {
    return "expired";
  }

  return "waiting";
};

export const generateReference = () => `ORIG-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

export const createBillingFromRequest = (requestBody = {}) => ({
  name:
    typeof requestBody?.customerName === "string" && requestBody.customerName.trim()
      ? requestBody.customerName.trim()
      : "Originals Printing Customer",
  email:
    typeof requestBody?.customerEmail === "string" && requestBody.customerEmail.trim()
      ? requestBody.customerEmail.trim()
      : "checkout@originalsprinting.local",
  phone:
    typeof requestBody?.customerPhone === "string" && requestBody.customerPhone.trim()
      ? requestBody.customerPhone.trim()
      : "",
  address: requestBody?.customerAddress
    ? {
        line1: typeof requestBody.customerAddress.line1 === "string" ? requestBody.customerAddress.line1.trim() : "",
        line2: typeof requestBody.customerAddress.line2 === "string" ? requestBody.customerAddress.line2.trim() : "",
        city: typeof requestBody.customerAddress.city === "string" ? requestBody.customerAddress.city.trim() : "",
        state: typeof requestBody.customerAddress.state === "string" ? requestBody.customerAddress.state.trim() : "",
        postal_code:
          typeof requestBody.customerAddress.postal_code === "string"
            ? requestBody.customerAddress.postal_code.trim()
            : "",
        country:
          typeof requestBody.customerAddress.country === "string" && requestBody.customerAddress.country.trim()
            ? requestBody.customerAddress.country.trim()
            : "PH",
      }
    : undefined,
});
