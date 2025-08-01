import express from "express"
import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import userAuth from "../middleware/userAuth.js"
import mongoose from "mongoose"

const router = express.Router()

// Clear corrupted cart data (temporary migration route)
router.post("/migrate-clean", userAuth, async (req, res) => {
  try {
    const userId = req.user.id
    console.log(`🧹 Cleaning corrupted cart data for user: ${userId}`)

    // Delete the existing cart to start fresh
    await Cart.findOneAndDelete({ userId })

    // Create a new empty cart
    const newCart = new Cart({ userId, items: [] })
    await newCart.save()

    console.log("✅ Cart cleaned and recreated successfully")
    res.json({ message: "Cart cleaned successfully", items: [] })
  } catch (error) {
    console.error("❌ Cart cleanup error:", error)
    res.status(500).json({ error: "Failed to clean cart" })
  }
})

// Add to cart
router.post("/add", userAuth, async (req, res) => {
  try {
    const { productId, variantIndex, variantId, quantity = 1, image } = req.body
    const userId = req.user.id

    console.log("🛒 AddToCart Request:", { userId, productId, variantIndex, variantId, quantity, image })

    if (!productId || (variantIndex === undefined && !variantId)) {
      return res.status(400).json({ message: "Missing productId or variant" })
    }

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    const variant =
      variantIndex !== undefined
        ? product.variants[variantIndex]
        : product.variants.find((v) => v._id?.toString() === variantId)
    if (!variant) return res.status(404).json({ message: "Variant not found" })

    let userCart = await Cart.findOne({ userId })
    if (!userCart) userCart = new Cart({ userId, items: [] })

    const finalVariantId = variantId || `${productId}_${variant.size || variantIndex}`

    // Prepare image array
    const imagesArray = [
      { url: image || product.images?.others?.[0]?.url || "/placeholder.svg" },
    ]

    // Check if this item already exists
    const existingItemIndex = userCart.items.findIndex(
      (item) => item._id.toString() === productId && item.variantId === finalVariantId
    )

    if (existingItemIndex !== -1) {
      userCart.items[existingItemIndex].quantity += quantity
    } else {
      const newItem = {
        _id: new mongoose.Types.ObjectId(productId),
        variantId: finalVariantId,
        title: product.title || "Unknown Product",
        images: { others: imagesArray },
        size: variant.size || `${variant.weight?.value || "N/A"} ${variant.weight?.unit || ""}`,
        weight: {
          value: variant.weight?.value || variant.size || "N/A",
          unit: variant.weight?.unit || (variant.size ? "size" : "unit"),
        },
        originalPrice: Number(variant.price) || 0,
        discountPercent: Number(variant.discountPercent) || 0,
        currentPrice: Number(variant.price - (variant.price * (variant.discountPercent || 0)) / 100) || 0,
        quantity: Number(quantity) || 1,
      }
      userCart.items.push(newItem)
    }

    await userCart.save()
    res.status(200).json({ message: "Added to cart successfully", cart: userCart })
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
    if (!cart) {
      console.log(`📦 No cart found for user ${userId}, returning empty.`)
      return res.json({ items: [] })
    }

    const items = Array.isArray(cart.items) ? cart.items : []
    console.log(`📦 Found ${items.length} items in cart for user ${userId}`)

    res.json({ items })
  } catch (error) {
    console.error("❌ Cart load error:", error)
    res.status(500).json({ error: "Failed to load cart" })
  }
})

// Sync cart items
router.post("/", userAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { items } = req.body

    console.log(`🔄 Syncing cart items for user ${userId}. Items count: ${items?.length || 0}`)

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items format" })
    }

    // Validate and prepare items
    const validItems = []
    for (const item of items) {
      if (!item._id || !item.variantId) {
        console.warn("⚠️ Skipping invalid item during sync:", item)
        continue
      }

      try {
        validItems.push({
          _id: new mongoose.Types.ObjectId(item._id),
          variantId: item.variantId,
          title: item.title || "Unknown Product",
          images: {
            others:
              item.images?.others?.map((img) => ({
                url: typeof img === "string" ? img : img?.url || "/placeholder.svg",
              })) || [],
          },
          size: item.size,
          weight: item.weight || { value: item.size, unit: "unit" },
          originalPrice: item.originalPrice || item.currentPrice || 0,
          discountPercent: item.discountPercent || 0,
          currentPrice: item.currentPrice || 0,
          quantity: item.quantity || 1,
        })
      } catch (itemError) {
        console.error("❌ Error processing item during sync:", item, itemError)
        continue
      }
    }

    // Use findOneAndUpdate with upsert to handle cart creation/update atomically
    const updatedCart = await Cart.findOneAndUpdate(
      { userId },
      { $set: { items: validItems } },
      { new: true, upsert: true, runValidators: true },
    )

    console.log("✅ Cart synced successfully with", updatedCart.items.length, "items")
    res.status(200).json({
      message: "Cart synced successfully",
      items: updatedCart.items,
    })
  } catch (error) {
    console.error("❌ Cart sync error:", error)

    if (error.code === 11000) {
      console.error("⚠️ Duplicate key error during cart sync")
      return res.status(500).json({
        message: "Server error: Duplicate cart detected. Please try clearing your cart.",
        error: error.message,
      })
    }

    res.status(500).json({
      message: "Server error while syncing cart",
      error: error.message,
    })
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
