 // File: routes/cartRoutes.js
 import express from 'express';
  import Cart from '../models/Cart.js';
  import auth from '../middleware/auth.js';
  import { verifyToken } from "../middleware/verifyToken.js";

  const router = express.Router();

  router.get("/", auth, async (req, res) => {
    try {
      const userId = req.user.userId;
      const cart = await Cart.findOne({ userId });
      res.json(cart?.items || []);
    } catch (error) {
      res.status(500).json({ error: "Failed to load cart" });
    }
  });

  router.post('/add', verifyToken, async (req, res) => {
    try {
      const userId = req.user.id;
      const { item } = req.body;

      let cart = await Cart.findOne({ userId });

      if (!cart) {
        cart = new Cart({ userId, items: [item] });
      } else {
        const existingIndex = cart.items.findIndex(i => i._id.toString() === item._id);
        if (existingIndex > -1) {
          cart.items[existingIndex].quantity += item.quantity || 1;
        } else {
          cart.items.push(item);
        }
      }

      await cart.save();
      res.status(200).json(cart.items);
    } catch (err) {
      console.error("Cart add error:", err);
      res.status(500).json({ message: "Failed to add to cart" });
    }
  });

router.post('/', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
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

  router.delete("/", auth, async (req, res) => {
    try {
      const userId = req.user.userId;
      await Cart.findOneAndDelete({ userId });
      res.json({ message: "Cart cleared" });
    } catch (error) {
      res.status(500).json({ error: "Failed to clear cart" });
    }
  });

export default router;
