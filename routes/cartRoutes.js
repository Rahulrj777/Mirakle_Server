import express from "express"
import Cart from "../models/Cart.js"
import userAuth from "../middleware/userAuth.js"

const router = express.Router()

router.get("/", userAuth, async (req, res) => {
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

router.post("/add", userAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { item } = req.body;

    if (!item || !item._id || !item.variantId) {
      return res.status(400).json({ message: "Invalid item data" });
    }

    let cart = await Cart.findOne({ userId })

    if (!cart) {
      cart = new Cart({ userId, items: [{ ...item, quantity: item.quantity || 1 }] })
    } else {
      const existingIndex = cart.items.findIndex(
        (i) =>
          i._id.toString() === item._id.toString() &&
          i.variantId?.toString() === item.variantId?.toString()
      );

      if (existingIndex > -1) {
        cart.items[existingIndex].quantity += item.quantity || 1
      } else cart.items.push({
        ...item,
        _id: item._id.toString(),
        variantId: item.variantId?.toString(),
        quantity: item.quantity || 1
      });
    }

    await cart.save()
    console.log(`✅ Cart updated for user ${userId}, total items: ${cart.items.length}`)

    res.status(200).json({ message: "Item added to cart", items: cart.items })
  } catch (err) {
    console.error("❌ Cart add error:", err)
    res.status(500).json({ message: "Failed to add to cart" })
  }
})

router.post("/", userAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { items } = req.body

    console.log(`🔄 Syncing cart for user: ${userId}`, items)

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items format" })
    }

    const cart = await Cart.findOneAndUpdate({ userId }, { $set: { items } }, { new: true, upsert: true })

    console.log(`✅ Cart synced for user ${userId}, total items: ${cart.items.length}`)
    res.status(200).json({ message: "Cart synced successfully", items: cart.items })
  } catch (error) {
    console.error("❌ Cart sync error:", error)
    res.status(500).json({ message: "Server error while syncing cart" })
  }
})

router.delete("/", userAuth, async (req, res) => {
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

router.patch("/update-quantity", userAuth, async (req, res) => {
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

router.delete("/item", userAuth, async (req, res) => {
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
