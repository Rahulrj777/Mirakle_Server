  import express from 'express';
  import Cart from '../models/Cart.js';
  import authMiddleware from '../middleware/auth.js';

  const router = express.Router();

 // Save/update cart - merge items instead of replacing
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const { items } = req.body;
      const userId = req.user.userId;

      let cart = await Cart.findOne({ userId });

      if (!cart) {
        cart = new Cart({ userId, items });
      } else {
        for (const newItem of items) {
          const index = cart.items.findIndex(
            i => i._id.toString() === newItem._id.toString()
          );

          if (index !== -1) {
            cart.items[index].quantity += newItem.quantity || 1;
          } else {
            cart.items.push({ ...newItem, quantity: newItem.quantity || 1 });
          }
        }
      }

      await cart.save();
      res.json({ message: 'Cart saved successfully', cart });
    } catch (error) {
      console.error("❌ Cart save failed:", error);
      res.status(500).json({ message: 'Server error', error: error.message });
    }
  });

// GET cart
router.get('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const cart = await Cart.findOne({ userId });
  res.json(cart?.items || []);
});

// DELETE cart
router.delete('/', authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  await Cart.findOneAndDelete({ userId });
  res.json({ message: 'Cart cleared' });
});

  export default router;
