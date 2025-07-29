// models/user.js
import mongoose from "mongoose"

const itemSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Product ID
    variantId: { type: String, required: true }, // ✅ FIXED: Changed to String for unique variant identification
    title: { type: String, required: true },
    images: {
      others: [
        {
          url: { type: String, default: "/placeholder.svg" },
          _id: false,
        },
      ],
    },
    size: { type: String },
    weight: {
      value: { type: mongoose.Schema.Types.Mixed },
      unit: { type: String },
    },
    originalPrice: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    currentPrice: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true, default: 1 },
    stock: { type: mongoose.Schema.Types.Mixed }, // Add this
    isOutOfStock: { type: Boolean, default: false }, // Add this
    stockMessage: { type: String }, 
  },
  { _id: false },
)

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [itemSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
  
)

export default mongoose.model("Cart", CartSchema)

module.exports = Cart