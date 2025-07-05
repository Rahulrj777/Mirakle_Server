import express from 'express';
import Cart from '../models/Cart.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get user's cart
router.get('/', authMiddleware, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id }); // ✅ fixed
  res.json(cart?.items || []);
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log("🔐 req.user:", req.user); // ✅ check decoded user
    console.log("🛒 Items received:", req.body.items);

    const { items } = req.body;
    let cart = await Cart.findOne({ userId: req.user.id });

    if (cart) {
      cart.items = items;
    } else {
      cart = new Cart({ userId: req.user.id, items });
    }

    await cart.save();
    res.json({ message: 'Cart saved' });
  } catch (error) {
    console.error("❌ Cart save failed:", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// Clear cart
router.delete('/', authMiddleware, async (req, res) => {
  await Cart.findOneAndDelete({ userId: req.user.id }); // ✅ fixed
  res.json({ message: 'Cart cleared' });
});

export default router;
