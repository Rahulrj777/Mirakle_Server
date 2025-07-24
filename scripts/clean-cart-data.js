// ✅ Database cleanup script to fix corrupted cart data
import mongoose from "mongoose"
import Cart from "../models/Cart.js"

async function cleanCorruptedCarts() {
  try {
    console.log("🧹 Starting cart data cleanup...")

    // Connect to MongoDB (you'll need to set your connection string)
    await mongoose.connect(process.env.MONGODB_URI || "your-mongodb-connection-string")

    // Find all carts
    const carts = await Cart.find({})
    console.log(`Found ${carts.length} carts to check`)

    let cleanedCount = 0

    for (const cart of carts) {
      try {
        // Try to validate the cart by saving it
        await cart.validate()
        console.log(`✅ Cart ${cart._id} is valid`)
      } catch (validationError) {
        console.log(`❌ Cart ${cart._id} has validation errors:`, validationError.message)

        // Delete the corrupted cart
        await Cart.findByIdAndDelete(cart._id)

        // Create a new clean cart
        const newCart = new Cart({
          userId: cart.userId,
          items: [],
        })
        await newCart.save()

        cleanedCount++
        console.log(`🧹 Cleaned and recreated cart for user ${cart.userId}`)
      }
    }

    console.log(`✅ Cleanup complete! Cleaned ${cleanedCount} corrupted carts`)
    process.exit(0)
  } catch (error) {
    console.error("❌ Cleanup failed:", error)
    process.exit(1)
  }
}

// Run the cleanup
cleanCorruptedCarts()
