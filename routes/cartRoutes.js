import express from 'express';
import Cart from '../models/Cart.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Get user's cart
router.get('/', authMiddleware, async (req, res) => {
  const cart = await Cart.findOne({ userId: req.user.id }); // ✅ fixed
  res.json(cart?.items || []);
});

// Save/update cart
router.post('/', authMiddleware, async (req, res) => {
  const { items } = req.body;
  let cart = await Cart.findOne({ userId: req.user.id }); // ✅ fixed

  if (cart) {
    cart.items = items;
  } else {
    cart = new Cart({ userId: req.user.id, items }); // ✅ fixed
  }

  await cart.save();
  res.json({ message: 'Cart saved' });
});

// Clear cart
router.delete('/', authMiddleware, async (req, res) => {
  await Cart.findOneAndDelete({ userId: req.user.id }); // ✅ fixed
  res.json({ message: 'Cart cleared' });
});

export default router;
