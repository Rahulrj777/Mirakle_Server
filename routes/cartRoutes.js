 // File: routes/cartRoutes.js
 import express from 'express';
  import Cart from '../models/Cart.js';
  import authMiddleware from '../middleware/auth.js';

  const router = express.Router();

// GET: Load cart for user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ userId: req.user.id });
    res.json(cart?.items || []);
  } catch (error) {
    res.status(500).json({ error: "Failed to load cart" });
  }
});

// POST: Save or update cart
router.post("/update", authMiddleware, async (req, res) => {
  try {
    const { items } = req.body;
    const updated = await Cart.findOneAndUpdate(
      { userId: req.user.id },
      { $set: { items } },
      { new: true, upsert: true }
    );
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "Failed to update cart" });
  }
});

// DELETE cart
router.delete('/', authMiddleware, async (req, res) => {
  const cart = await Cart.findOne({ userId });
  await Cart.findOneAndDelete({ userId });
  res.json({ message: 'Cart cleared' });
});

  export default router;
