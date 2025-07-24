import express from "express"
import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import userAuth from "../middleware/userAuth.js"

const router = express.Router()

// ✅ FIXED: Handle variants without _id using index
router.post("/add", userAuth, async (req, res) => {
  try {
    const { productId, variantIndex, variantId, quantity = 1 } = req.body
    const userId = req.user.id

    console.log("🛒 AddToCart Request:", { userId, productId, variantIndex, variantId, quantity })

    // Validate required fields
    if (!productId || (variantIndex === undefined && !variantId) || !userId) {
      console.error("❌ Missing required fields:", { productId, variantIndex, variantId, userId })
      return res
        .status(400)
        .json({ message: "Invalid item data - missing productId, variantIndex/variantId, or userId" })
    }

    // Verify product exists
    const product = await Product.findById(productId)
    if (!product) {
      console.error("❌ Product not found:", productId)
      return res.status(404).json({ message: "Product not found" })
    }

    // Get variant by index if provided, otherwise try to find by _id
    let variant
    if (variantIndex !== undefined) {
      variant = product.variants[variantIndex]
      if (!variant) {
        console.error("❌ Variant not found at index:", variantIndex)
        return res.status(404).json({ message: "Variant not found at specified index" })
      }
    } else {
      variant = product.variants.id(variantId)
      if (!variant) {
        console.error("❌ Variant not found with ID:", variantId)
        return res.status(404).json({ message: "Variant not found" })
      }
    }

    // Find or create user cart
    let userCart = await Cart.findOne({ userId })
    if (!userCart) {
      userCart = new Cart({ userId, items: [] })
    }

    // Use the provided variantId or generate one from index
    const finalVariantId = variantId || `${productId}_variant_${variantIndex}_${variant.size}`

    // Check if item already exists in cart
    const existingItem = userCart.items.find(
      (item) => item._id.toString() === productId && item.variantId === finalVariantId,
    )

    if (existingItem) {
      // Update quantity of existing item
      existingItem.quantity += quantity
      console.log("✅ Updated existing item quantity:", existingItem.quantity)
    } else {
      // Add new item to cart
      const newItem = {
        _id: productId,
        variantId: finalVariantId,
        title: product.title,
        images: product.images,
        size: variant.size || `${variant.weight?.value} ${variant.weight?.unit}`,
        weight: {
          value: variant.weight?.value || variant.size,
          unit: variant.weight?.unit || "unit",
        },
        currentPrice: variant.price - (variant.price * (variant.discountPercent || 0)) / 100,
        quantity: quantity,
      }

      userCart.items.push(newItem)
      console.log("✅ Added new item to cart:", newItem)
    }

    await userCart.save()
    console.log("✅ Cart saved successfully")

    res.status(200).json({
      message: "Added to cart successfully",
      cart: userCart,
      itemsCount: userCart.items.length,
    })
  } catch (error) {
    console.error("❌ AddToCart Error:", error)
    res.status(500).json({ message: "Server error", error: error.message })
  }
})

// Get cart items
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

// Sync multiple cart items (for bulk operations)
router.post("/", userAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { items } = req.body

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items format" })
    }

    // Load or create cart
    let cart = await Cart.findOne({ userId })
    if (!cart) {
      cart = new Cart({ userId, items: [] })
    }

    // Add items one by one with variant-based uniqueness
    for (const item of items) {
      if (!item._id || !item.variantId) continue

      const existingItem = cart.items.find(
        (i) => i._id.toString() === item._id.toString() && i.variantId === item.variantId,
      )

      if (existingItem) {
        // Update quantity (optional logic, or skip)
        existingItem.quantity += item.quantity || 1
      } else {
        cart.items.push({ ...item, quantity: item.quantity || 1 })
      }
    }

    await cart.save()
    res.status(200).json({ message: "Cart synced successfully", items: cart.items })
  } catch (error) {
    console.error("❌ Cart sync error:", error)
    res.status(500).json({ message: "Server error while syncing cart" })
  }
})

// Clear cart
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

// Update item quantity
router.patch("/update-quantity", userAuth, async (req, res) => {
  try {
    const { _id, variantId, quantity } = req.body
    const userId = req.user.id

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ message: "Cart not found" })

    const item = cart.items.find((i) => i._id.toString() === _id.toString() && i.variantId === variantId)

    if (!item) return res.status(404).json({ message: "Item not found in cart" })

    item.quantity = quantity
    await cart.save()

    res.json({ message: "Quantity updated", items: cart.items })
  } catch (error) {
    console.error("❌ Update quantity error:", error)
    res.status(500).json({ error: "Failed to update quantity" })
  }
})

// Remove item from cart
router.delete("/item", userAuth, async (req, res) => {
  try {
    const { _id, variantId } = req.body
    const userId = req.user.id

    const cart = await Cart.findOne({ userId })
    if (!cart) return res.status(404).json({ message: "Cart not found" })

    cart.items = cart.items.filter((i) => !(i._id.toString() === _id.toString() && i.variantId === variantId))

    await cart.save()
    res.json({ message: "Item removed", items: cart.items })
  } catch (error) {
    console.error("❌ Remove item error:", error)
    res.status(500).json({ error: "Failed to remove item" })
  }
})

export default router
