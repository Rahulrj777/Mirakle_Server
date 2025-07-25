const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const User = mongoose.model("User")
const Product = mongoose.model("Product")
const requireLogin = require("../middleware/requireLogin")
const { generateVariantId } = require("../utils/cartUtils") // Import the new utility

// Helper to get user cart and populate it
async function getUserCart(userId) {
  return await User.findById(userId).populate({
    path: "cart.items._id",
    select: "_id title images variants", // Select necessary fields for population
  })
}

router.post("/cart/add", requireLogin, async (req, res) => {
  const { productId, quantity, variantIndex } = req.body

  if (!productId || quantity <= 0 || variantIndex === undefined) {
    console.error("Backend /cart/add: Invalid request data - missing productId, quantity, or variantIndex.")
    return res.status(400).json({ message: "Invalid request data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      console.error(`Backend /cart/add: User not found for ID: ${req.user._id}`)
      return res.status(404).json({ message: "User not found" })
    }

    let userCart = await getUserCart(req.user._id)
    if (!userCart) {
      console.warn(`Backend /cart/add: Cart not found for user ${req.user._id}, initializing new cart.`)
      // If user exists but no cart, create an empty cart within the user document
      user.cart = { items: [] }
      userCart = user // Use the updated user object
    }

    const product = await Product.findById(productId)
    if (!product) {
      console.error(`Backend /cart/add: Product not found for ID: ${productId}`)
      return res.status(404).json({ message: "Product not found" })
    }

    const selectedVariant = product.variants[variantIndex]
    if (!selectedVariant) {
      console.error(`Backend /cart/add: Invalid variant index ${variantIndex} for product ${productId}`)
      return res.status(400).json({ message: "Invalid variant selected" })
    }

    // ✅ CRITICAL FIX: Generate the uniqueCartItemId on the backend using the same utility
    const uniqueCartItemId = generateVariantId(productId, selectedVariant, variantIndex)

    console.log(
      `Backend /cart/add: Product ID: ${productId}, Variant Index: ${variantIndex}, Generated Variant ID: ${uniqueCartItemId}`,
    )

    const existingItem = userCart.cart.items.find(
      // Access cart.items
      (item) => item._id.toString() === productId && item.variantId === uniqueCartItemId,
    )

    if (existingItem) {
      existingItem.quantity += quantity
      console.log(
        `Backend /cart/add: Incremented quantity for existing item ${productId} (${uniqueCartItemId}) to ${existingItem.quantity}`,
      )
    } else {
      const newItem = {
        _id: productId,
        title: product.title,
        images: product.images,
        variantId: uniqueCartItemId, // Use the consistently constructed uniqueCartItemId here
        size:
          selectedVariant.size ||
          (selectedVariant.weight ? `${selectedVariant.weight.value} ${selectedVariant.weight.unit}` : "N/A"),
        weight: {
          value: selectedVariant?.weight?.value || selectedVariant?.size,
          unit: selectedVariant?.weight?.unit || (selectedVariant?.size ? "size" : "unit"),
        },
        originalPrice: Number.parseFloat(selectedVariant.price),
        discountPercent: Number.parseFloat(selectedVariant.discountPercent) || 0,
        currentPrice: Number.parseFloat(
          (selectedVariant.price - (selectedVariant.price * (selectedVariant.discountPercent || 0)) / 100).toFixed(2),
        ),
        quantity: quantity,
      }
      userCart.cart.items.push(newItem) // Access cart.items
      console.log(`Backend /cart/add: Added new item ${productId} (${uniqueCartItemId}) with quantity ${quantity}`)
    }

    await userCart.save()
    // Re-populate to send back full item details
    const updatedCart = await getUserCart(req.user._id)
    res.json({ message: "Item added to cart successfully", cart: updatedCart.cart.items })
  } catch (err) {
    console.error("Backend /cart/add error:", err)
    res.status(500).json({ message: "Failed to add item to cart", error: err.message })
  }
})

router.get("/cart", requireLogin, async (req, res) => {
  try {
    const userCart = await getUserCart(req.user._id)

    if (!userCart) {
      console.warn(`Backend /cart GET: Cart not found for user ${req.user._id}, returning empty cart.`)
      return res.json({ cart: [] }) // Return empty cart if not found
    }

    res.json({ cart: userCart.cart.items }) // Access cart.items
  } catch (err) {
    console.error("Backend /cart GET error:", err)
    res.status(500).json({ message: "Failed to retrieve cart", error: err.message })
  }
})

// ✅ UPDATED ROUTE: Use /cart/update-quantity for clarity and consistency
router.put("/cart/update-quantity", requireLogin, async (req, res) => {
  const { productId, variantId, quantity } = req.body

  if (!productId || quantity === undefined || quantity <= 0 || !variantId) {
    console.error("Backend /cart/update-quantity: Invalid request data - missing productId, variantId, or quantity.")
    return res.status(400).json({ message: "Invalid request data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      console.error(`Backend /cart/update-quantity: User not found for ID: ${req.user._id}`)
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await getUserCart(req.user._id)

    if (!userCart) {
      console.warn(`Backend /cart/update-quantity: Cart not found for user ${req.user._id}.`)
      return res.status(404).json({ message: "Cart not found" })
    }

    // ✅ CRITICAL FIX: Use variantId for finding item to update
    const itemToUpdate = userCart.cart.items.find(
      (item) => item._id.toString() === productId && item.variantId === variantId,
    )

    if (!itemToUpdate) {
      console.error(
        `Backend /cart/update-quantity: Item not found in cart for product ${productId} and variant ${variantId}`,
      )
      return res.status(404).json({ message: "Item not found in cart" })
    }

    itemToUpdate.quantity = quantity

    await userCart.save()
    const updatedCart = await getUserCart(req.user._id)
    res.json({ message: "Cart updated successfully", cart: updatedCart.cart.items })
  } catch (err) {
    console.error("Backend /cart/update-quantity error:", err)
    res.status(500).json({ message: "Failed to update cart", error: err.message })
  }
})

// ✅ UPDATED ROUTE: Use /cart/remove-item for clarity and consistency
router.delete("/cart/remove-item", requireLogin, async (req, res) => {
  const { productId, variantId } = req.body // Changed from query to body for consistency

  if (!productId || !variantId) {
    console.error("Backend /cart/remove-item: Invalid request data - missing productId or variantId.")
    return res.status(400).json({ message: "Invalid request data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      console.error(`Backend /cart/remove-item: User not found for ID: ${req.user._id}`)
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await getUserCart(req.user._id)

    if (!userCart) {
      console.warn(`Backend /cart/remove-item: Cart not found for user ${req.user._id}.`)
      return res.status(404).json({ message: "Cart not found" })
    }

    const initialLength = userCart.cart.items.length
    userCart.cart.items = userCart.cart.items.filter(
      // Access cart.items
      (item) => !(item._id.toString() === productId && item.variantId === variantId),
    )

    if (userCart.cart.items.length === initialLength) {
      console.warn(`Backend /cart/remove-item: Item ${productId} (${variantId}) not found in cart to remove.`)
      return res.status(404).json({ message: "Item not found in cart to remove" })
    }

    await userCart.save()
    const updatedCart = await getUserCart(req.user._id)
    res.json({ message: "Item removed from cart successfully", cart: updatedCart.cart.items })
  } catch (err) {
    console.error("Backend /cart/remove-item error:", err)
    res.status(500).json({ message: "Failed to remove item from cart", error: err.message })
  }
})

router.delete("/cart/clear", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      console.error(`Backend /cart/clear: User not found for ID: ${req.user._id}`)
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await getUserCart(req.user._id)

    if (!userCart) {
      console.warn(`Backend /cart/clear: Cart not found for user ${req.user._id}.`)
      return res.status(404).json({ message: "Cart not found" })
    }

    userCart.cart.items = [] // Access cart.items

    await userCart.save()
    const updatedCart = await getUserCart(req.user._id)
    res.json({ message: "Cart cleared successfully", cart: updatedCart.cart.items })
  } catch (err) {
    console.error("Backend /cart/clear error:", err)
    res.status(500).json({ message: "Failed to clear cart", error: err.message })
  }
})

// This route is for syncing the client-side cart to the backend, typically on login.
router.post("/cart", requireLogin, async (req, res) => {
  const { items: clientItems } = req.body

  if (!clientItems || !Array.isArray(clientItems)) {
    console.error("Backend /cart POST (sync): Invalid client items data received.")
    return res.status(400).json({ message: "Invalid client items data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      console.error(`Backend /cart POST (sync): User not found for ID: ${req.user._id}`)
      return res.status(404).json({ message: "User not found" })
    }

    let userCart = await getUserCart(req.user._id)
    if (!userCart) {
      console.warn(`Backend /cart POST (sync): Cart not found for user ${req.user._id}, creating new cart.`)
      user.cart = { items: [] } // Create new user with empty cart
      userCart = user
    }

    userCart.cart.items = [] // ✅ CRITICAL: Clear existing cart items before re-populating from client

    for (const clientItem of clientItems) {
      console.log(
        `Backend /cart POST (sync): Processing client item - Product ID: ${clientItem._id}, Client Variant ID: ${clientItem.variantId}, Quantity: ${clientItem.quantity}`,
      )

      const product = await Product.findById(clientItem._id)
      if (!product) {
        console.warn(`Backend /cart POST (sync): Product not found for ID: ${clientItem._id}. Skipping item.`)
        continue
      }

      // Find the variant based on the clientItem.variantId
      const variant = product.variants.find((v, index) => {
        // ✅ CRITICAL FIX: Use the consistent generateVariantId utility to find the matching variant
        const generatedVariantIdForComparison = generateVariantId(product._id, v, index)
        console.log(
          `Backend /cart POST (sync): Comparing clientVariantId '${clientItem.variantId}' with generated '${generatedVariantIdForComparison}' for variant at index ${index}.`,
        )
        return generatedVariantIdForComparison === clientItem.variantId
      })

      if (!variant) {
        console.warn(
          `Backend /cart POST (sync): Variant not found for product ID: ${clientItem._id} and clientVariantId: ${clientItem.variantId}. Skipping item.`,
        )
        continue
      }

      // Check if this specific product-variant combination already exists in the *newly building* cart
      const existingAggregatedItem = userCart.cart.items.find(
        (item) => item._id.toString() === clientItem._id && item.variantId === clientItem.variantId,
      )

      if (existingAggregatedItem) {
        existingAggregatedItem.quantity += clientItem.quantity
        console.log(
          `Backend /cart POST (sync): Aggregated quantity for existing item ${clientItem._id} (${clientItem.variantId}) to ${existingAggregatedItem.quantity}`,
        )
      } else {
        const newItem = {
          _id: clientItem._id,
          title: product.title,
          images: product.images,
          variantId: clientItem.variantId, // Use the variantId from the client, which is now consistent
          size: variant.size || (variant.weight ? `${variant.weight.value} ${variant.weight.unit}` : "N/A"),
          weight: {
            value: variant?.weight?.value || variant?.size,
            unit: variant?.weight?.unit || (variant?.size ? "size" : "unit"),
          },
          originalPrice: Number.parseFloat(variant.price),
          discountPercent: Number.parseFloat(variant.discountPercent) || 0,
          currentPrice: Number.parseFloat(
            (variant.price - (variant.price * (variant.discountPercent || 0)) / 100).toFixed(2),
          ),
          quantity: clientItem.quantity,
        }
        userCart.cart.items.push(newItem)
        console.log(
          `Backend /cart POST (sync): Added new item ${clientItem._id} (${clientItem.variantId}) with quantity ${clientItem.quantity}`,
        )
      }
    }

    await userCart.save()
    const populatedCart = await getUserCart(req.user._id)
    res.json({ message: "Cart synchronized successfully", cart: populatedCart.cart.items })
  } catch (err) {
    console.error("Backend /cart POST (sync) error:", err)
    res.status(500).json({ message: "Failed to synchronize cart", error: err.message })
  }
})

module.exports = router
