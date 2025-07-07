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

  router.post("/update", authMiddleware, async (req, res) => {
    try {
      const userId = req.user.userId;
      const { items } = req.body;
      const updated = await Cart.findOneAndUpdate(
        { userId },
        { $set: { items } },
        { new: true, upsert: true }
      );
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to update cart" });
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
