 // File: routes/cartRoutes.js
 import express from 'express';
  import Cart from '../models/Cart.js';
  import authMiddleware from '../middleware/auth.js';

  const router = express.Router();

  router.get("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const cart = await Cart.findOne({ userId });
      res.json(cart?.items || []);
    } catch (error) {
      res.status(500).json({ error: "Failed to load cart" });
    }
  });

router.post('/update', authMiddleware, async (req, res) => {
  try {
    console.log("🛒 Incoming cart update request");
    console.log("👉 Request body:", req.body);
    console.log("🔐 Decoded user ID:", req.user?.id);

    const userId = req.user.id;
    const items = req.body.items;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items format" });
    }

    const cart = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items } },
      { new: true, upsert: true }
    );

    console.log("✅ Cart successfully updated:", cart);

    res.status(200).json({ message: "Item(s) added to cart", cart });
  } catch (error) {
    console.error("🔥 Cart Update Error:", error);
    res.status(500).json({ message: "Server error while updating cart" });
  }
});

  router.delete("/", authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      await Cart.findOneAndDelete({ userId });
      res.json({ message: "Cart cleared" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

export default router;
