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

// Add to cart (merge behavior)
router.post("/", authMiddleware, async (req, res) => {
  const userId = req.user.userId;
  const { items } = req.body;

  try {
    let cart = await Cart.findOne({ userId });

    if (!cart) {
      cart = new Cart({ userId, items });
    } else {
      for (const newItem of items) {
        const index = cart.items.findIndex(
          (i) => i.productId.toString() === newItem._id.toString()
        );

        if (index !== -1) {
          cart.items[index].quantity += newItem.quantity || 1;
        } else {
          cart.items.push({ ...newItem, productId: newItem._id });
        }
      }
    }

    await cart.save();
    res.json({ message: "Item(s) added to cart", cart });
  } catch (error) {
    console.error("❌ Add to cart error:", error);
    res.status(500).json({ error: "Failed to add item to cart" });
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
