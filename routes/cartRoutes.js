const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const User = mongoose.model("User")
const Product = mongoose.model("Product")
const requireLogin = require("../middleware/requireLogin")

router.post("/cart/add", requireLogin, async (req, res) => {
  const { productId, quantity, variantIndex, clientVariantId } = req.body

  if (!productId || quantity <= 0 || variantIndex === undefined) {
    return res.status(400).json({ message: "Invalid request data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await User.findById(req.user._id).populate("cart.items._id", "_id title images variants")

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found for user" })
    }

    const product = await Product.findById(productId)
    if (!product) {
      return res.status(404).json({ message: "Product not found" })
    }

    // Find if the item already exists in the cart
    // The `finalVariantId` here needs to be constructed exactly like the `variantId` on the frontend.
    // Frontend uses: `${product._id}_${variantKey}` where variantKey is selectedVariant._id or a composite.
    // So, we need to ensure the backend's `finalVariantId` also includes the `productId` prefix.

    // Find the selected variant from the product's variants array
    const selectedVariant = product.variants[variantIndex]
    if (!selectedVariant) {
      return res.status(400).json({ message: "Invalid variant selected" })
    }

    // Determine the variant-specific key (e.g., variant's _id, size, or weight composite)
    // This part should match the `variantKey` logic in ProductDetail.jsx
    const variantSpecificKey =
      selectedVariant._id?.toString() ||
      (selectedVariant.size || selectedVariant.weight
        ? `${selectedVariant.size || selectedVariant.weight.value}_${selectedVariant.weight?.unit || ""}`
        : variantIndex.toString()) // Ensure it's a string for consistency

    // Construct the full unique variantId, matching frontend's pattern: productId_variantSpecificKey
    const uniqueCartItemId = `${productId}_${variantSpecificKey}`

    console.log(`Backend: Incoming clientVariantId: ${clientVariantId}`)
    console.log(`Backend: Constructed uniqueCartItemId for comparison: ${uniqueCartItemId}`)

    const existingItem = userCart.items.find(
      (item) => item._id.toString() === productId && item.variantId === uniqueCartItemId,
    )

    if (existingItem) {
      // If item exists, increment quantity
      existingItem.quantity += quantity
      console.log(
        `Backend: Incremented quantity for existing item ${productId} (${uniqueCartItemId}) to ${existingItem.quantity}`,
      )
    } else {
      // If item does not exist, add new item
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
      userCart.items.push(newItem)
      console.log(`Backend: Added new item ${productId} (${uniqueCartItemId}) with quantity ${quantity}`)
    }

    await userCart.save()
    res.json({ message: "Item added to cart successfully", cart: userCart.items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to add item to cart", error: err.message })
  }
})

router.get("/cart", requireLogin, async (req, res) => {
  try {
    const userCart = await User.findById(req.user._id).populate("cart.items._id", "_id title images variants")

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found for user" })
    }

    res.json({ cart: userCart.items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to retrieve cart", error: err.message })
  }
})

router.put("/cart/update/:productId", requireLogin, async (req, res) => {
  const { productId } = req.params
  const { quantity } = req.body

  if (!productId || quantity === undefined || quantity <= 0) {
    return res.status(400).json({ message: "Invalid request data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await User.findById(req.user._id).populate("cart.items._id", "_id title images variants")

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found for user" })
    }

    const itemIndex = userCart.items.findIndex((item) => item._id.toString() === productId)

    if (itemIndex === -1) {
      return res.status(404).json({ message: "Item not found in cart" })
    }

    userCart.items[itemIndex].quantity = quantity

    await userCart.save()
    res.json({ message: "Cart updated successfully", cart: userCart.items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to update cart", error: err.message })
  }
})

router.delete("/cart/remove/:productId", requireLogin, async (req, res) => {
  const { productId } = req.params

  if (!productId) {
    return res.status(400).json({ message: "Invalid request data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await User.findById(req.user._id).populate("cart.items._id", "_id title images variants")

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found for user" })
    }

    userCart.items = userCart.items.filter((item) => item._id.toString() !== productId)

    await userCart.save()
    res.json({ message: "Item removed from cart successfully", cart: userCart.items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to remove item from cart", error: err.message })
  }
})

router.delete("/cart/clear", requireLogin, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await User.findById(req.user._id).populate("cart.items._id", "_id title images variants")

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found for user" })
    }

    userCart.items = []

    await userCart.save()
    res.json({ message: "Cart cleared successfully", cart: userCart.items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to clear cart", error: err.message })
  }
})

router.post("/", requireLogin, async (req, res) => {
  const { clientItems } = req.body

  if (!clientItems || !Array.isArray(clientItems)) {
    return res.status(400).json({ message: "Invalid client items data" })
  }

  try {
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    const userCart = await User.findById(req.user._id)

    if (!userCart) {
      return res.status(404).json({ message: "Cart not found for user" })
    }

    userCart.items = [] // Clear existing cart items

    for (const clientItem of clientItems) {
      // Add more detailed logging for debugging if needed:
      // Inside the loop for `clientItems`:
      console.log(
        `Backend Sync: Processing client item - Product ID: ${clientItem._id}, Variant ID: ${clientItem.variantId}, Quantity: ${clientItem.quantity}`,
      )

      const product = await Product.findById(clientItem._id)
      if (!product) {
        console.warn(`Product not found for ID: ${clientItem._id}`)
        continue // Skip to the next item
      }

      const existingAggregatedItem = userCart.items.find(
        (item) => item._id.toString() === clientItem._id && item.variantId === clientItem.variantId,
      )

      console.log(`Backend Sync: Found existing aggregated item: ${!!existingAggregatedItem}`)

      if (existingAggregatedItem) {
        existingAggregatedItem.quantity += clientItem.quantity
      } else {
        const variant = product.variants.find((v) => {
          const variantSpecificKey =
            v._id?.toString() ||
            (v.size || v.weight
              ? `${v.size || v.weight.value}_${v.weight?.unit || ""}`
              : product.variants.indexOf(v).toString())
          const uniqueCartItemId = `${clientItem._id}_${variantSpecificKey}`
          return uniqueCartItemId === clientItem.variantId
        })

        if (!variant) {
          console.warn(`Variant not found for product ID: ${clientItem._id} and variantId: ${clientItem.variantId}`)
          continue
        }

        const newItem = {
          _id: clientItem._id,
          title: product.title,
          images: product.images,
          variantId: clientItem.variantId,
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
        userCart.items.push(newItem)
      }
    }

    await userCart.save()
    const populatedCart = await User.findById(req.user._id).populate("cart.items._id", "_id title images variants")
    res.json({ message: "Cart synchronized successfully", cart: populatedCart.items })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: "Failed to synchronize cart", error: err.message })
  }
})

module.exports = router
