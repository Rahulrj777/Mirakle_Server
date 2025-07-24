import express from "express"
import Cart from "../models/Cart.js"
import Product from "../models/Product.js"
import userAuth from "../middleware/userAuth.js"
import mongoose from "mongoose"

const router = express.Router()

// ✅ NEW: Clear corrupted cart data (temporary migration route)
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

// ✅ ENHANCED: Handle variants without _id using index with better error handling
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
      // Fallback to finding by variantId if index is not provided
      variant = product.variants.find((v) => v._id?.toString() === variantId)
      if (!variant) {
        console.error("❌ Variant not found with ID:", variantId)
        return res.status(404).json({ message: "Variant not found" })
      }
    }

    // ✅ ENHANCED: Try to find cart, if corrupted, recreate it
    let userCart
    try {
      userCart = await Cart.findOne({ userId })
    } catch (findError) {
      console.warn("⚠️ Cart find error, recreating:", findError.message)
      await Cart.findOneAndDelete({ userId })
      userCart = null
    }

    if (!userCart) {
      userCart = new Cart({ userId, items: [] })
    }

    // Use the provided variantId or generate one from index
    const finalVariantId = variantId || `${productId}_variant_${variantIndex}_${variant.size || "unknown"}`

    // Check if item already exists in cart
    const existingItem = userCart.items.find(
      (item) => item._id.toString() === productId && item.variantId === finalVariantId,
    )

    const newItem = {
      _id: new mongoose.Types.ObjectId(productId),
      variantId: finalVariantId,
      title: product.title || "Unknown Product",
      images: {
        others: Array.isArray(product.images?.others)
          ? product.images.others.map((img) => ({
              url: typeof img === "string" ? img : img?.url || "/placeholder.svg",
            }))
          : [{ url: "/placeholder.svg" }],
      },
      size: variant.size || `${variant.weight?.value || "N/A"} ${variant.weight?.unit || ""}`,
      weight: {
        value: variant.weight?.value || variant.size || "N/A",
        unit: variant.weight?.unit || "unit",
      },
      originalPrice: Number(variant.price) || 0,
      discountPercent: Number(variant.discountPercent) || 0,
      currentPrice: Number(variant.price - (variant.price * (variant.discountPercent || 0)) / 100) || 0,
      quantity: Number(quantity) || 1,
    }

    if (existingItem) {
      // Update quantity of existing item
      existingItem.quantity += quantity
      console.log("✅ Updated existing item quantity:", existingItem.quantity)
    } else {
      // ✅ ENHANCED: Create new item with extra validation
      userCart.items.push(newItem)
      console.log("✅ Added new item to cart:", newItem)
    }

    // ✅ ENHANCED: Save with better error handling
    try {
      await userCart.save()
      console.log("✅ Cart saved successfully")
    } catch (saveError) {
      console.error("❌ Cart save error:", saveError)
      // If save fails due to validation, try to clean and recreate
      if (saveError.name === "ValidationError" || saveError.name === "VersionError") {
        console.log("🧹 Attempting to clean and recreate cart due to validation/version error")
        await Cart.findOneAndDelete({ userId })
        const cleanCart = new Cart({ userId, items: [newItem] })
        await cleanCart.save()
        console.log("✅ Cart recreated successfully")
      } else {
        throw saveError
      }
    }

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

// ✅ FIXED: Sync multiple cart items with proper validation
router.post("/", userAuth, async (req, res) => {
  try {
    const userId = req.user.id
    const { items } = req.body

    console.log("🔄 Syncing cart items:", items?.length || 0)

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ message: "Invalid items format" })
    }

    // Find or create cart
    let cart
    try {
      cart = await Cart.findOne({ userId })
    } catch (findError) {
      console.warn("⚠️ Cart find error during sync, recreating:", findError.message)
      await Cart.findOneAndDelete({ userId })
      cart = null
    }

    if (!cart) {
      cart = new Cart({ userId, items: [] })
    }

    // Clear existing items and add new ones
    cart.items = []

    // Add items one by one with proper validation
    for (const item of items) {
      if (!item._id || !item.variantId) {
        console.warn("⚠️ Skipping invalid item during sync:", item)
        continue
      }

      try {
        // ✅ FIXED: Ensure proper data structure
        const cartItem = {
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
        }

        cart.items.push(cartItem)
      } catch (itemError) {
        console.error("❌ Error processing item during sync:", item, itemError)
        continue
      }
    }

    // ✅ ENHANCED: Save with better error handling for sync
    try {
      await cart.save()
      console.log("✅ Cart synced successfully with", cart.items.length, "items")
    } catch (saveError) {
      console.error("❌ Cart sync save error:", saveError)
      if (saveError.name === "ValidationError" || saveError.name === "VersionError") {
        console.log("🧹 Attempting to clean and re-sync cart due to validation/version error")
        await Cart.findOneAndDelete({ userId })
        const cleanCart = new Cart({ userId, items: cart.items }) // Re-add the items that were just processed
        await cleanCart.save()
        console.log("✅ Cart re-synced successfully after cleanup")
      } else {
        throw saveError
      }
    }

    res.status(200).json({ message: "Cart synced successfully", items: cart.items })
  } catch (error) {
    console.error("❌ Cart sync error:", error)
    res.status(500).json({ message: "Server error while syncing cart", error: error.message })
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
