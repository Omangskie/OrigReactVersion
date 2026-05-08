import { paymongoKeyMode, paymongoSecretKey } from "./_lib/paymongo.js";


export default function handler(_req, res) {

  return res.status(200).json({
    ok: true,
    paymongoConfigured: Boolean(paymongoSecretKey),
    paymongoKeyMode,
    runtime: "vercel-function",
  });
}
