import express from "express"
import Cart from "../models/Cart.js"
import userAuth from "../middleware/userAuth.js"
import addToCart from "../controllers/cartController.js";

const router = express.Router()

router.get("/", userAuth,addToCart, async (req, res) => {
  try {
    const userId = req.user.id
    console.log(`📦 Loading cart for user: ${userId}`)

    const cart = await Cart.findOne({ userId })
    const items = cart?.items || []

    console.log(`📦 Found ${items.length} items in cart for user ${userId}`)
    res.json({ items })
  } catch (error) {
    console.error("❌ Cart load error:", error)
    res.status(500).json({ error: "Failed to load cart" })
  }
})

router.post("/", userAuth, addToCart, async (req, res) => {
  try {
    const userId = req.user.id;
    const { items } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items format" });
    }

    // Load or create cart
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = new Cart({ userId, items: [] });
    }

    // Add items one by one with variant-based uniqueness
    for (const item of items) {
      if (!item._id || !item.variantId) continue;

      const existingItem = cart.items.find(
        (i) => i._id.toString() === item._id.toString() && i.variantId.toString() === item.variantId.toString()
      );

      if (existingItem) {
        // Update quantity (optional logic, or skip)
        existingItem.quantity += item.quantity || 1;
      } else {
        cart.items.push({ ...item, quantity: item.quantity || 1 });
      }
    }

    await cart.save();

    res.status(200).json({ message: "Cart synced successfully", items: cart.items });
  } catch (error) {
    console.error("❌ Cart sync error:", error);
    res.status(500).json({ message: "Server error while syncing cart" });
  }
});

router.delete("/", userAuth,addToCart, async (req, res) => {
  try {
    const userId = req.user.id
    console.log(`🗑️ Clearing cart for user: ${userId}`)

    await Cart.findOneAndDelete({ userId })
    res.json({ message: "Cart cleared" })
  } catch (error) {
    console.error("❌ Cart clear error:", error)
    res.status(500).json({ error: "Failed to clear cart" })
  }
})

router.patch("/update-quantity", userAuth,addToCart, async (req, res) => {
  const { _id, variantId, quantity } = req.body
  const userId = req.user.id

  const cart = await Cart.findOne({ userId })
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  const item = cart.items.find(
    (i) => i._id.toString() === _id.toString() && i.variantId?.toString() === variantId?.toString()
  )
  if (!item) return res.status(404).json({ message: "Item not found in cart" })

  item.quantity = quantity
  await cart.save()

  res.json({ message: "Quantity updated", items: cart.items })
})

router.delete("/item", userAuth,addToCart, async (req, res) => {
  const { _id, variantId } = req.body
  const userId = req.user.id

  const cart = await Cart.findOne({ userId })
  if (!cart) return res.status(404).json({ message: "Cart not found" })

  cart.items = cart.items.filter(
    (i) => !(i._id.toString() === _id.toString() && i.variantId?.toString() === variantId?.toString())
  )
  await cart.save()

  res.json({ message: "Item removed", items: cart.items })
})

export default router
