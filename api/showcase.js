import { getFirebaseAdmin } from "./_lib/firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ message: "Method not allowed." });
  }

  try {
    const { db } = getFirebaseAdmin();
    const category = typeof req.query?.category === "string" && req.query.category.trim() ? req.query.category.trim() : "";

    let queryRef = db.collection("showcase").orderBy("createdAt", "desc");
    if (category) {
      queryRef = queryRef.where("category", "==", category);
    }

    try {
      const snapshot = await queryRef.get();
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));
      return res.status(200).json({ ok: true, items });
    } catch {
      const allSnapshot = await db.collection("showcase").get();
      let items = allSnapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() || {}) }));

      if (category) {
        items = items.filter((item) => String(item.category || "") === category);
      }

      items.sort((a, b) => {
        const ta = a.createdAt ? Date.parse(a.createdAt) : 0;
        const tb = b.createdAt ? Date.parse(b.createdAt) : 0;
        return tb - ta;
      });

      return res.status(200).json({ ok: true, items });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, message: error?.message || "Unable to load showcase items." });
  }
}
