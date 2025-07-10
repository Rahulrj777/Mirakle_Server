import mongoose from "mongoose"

const itemSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true }, // Product ID
    variantId: { type: mongoose.Schema.Types.ObjectId }, // Variant ID for size/weight
    title: { type: String, required: true },
    images: {
      others: [{ type: String }],
    },
    size: { type: String }, // Size info for display
    weight: {
      value: { type: mongoose.Schema.Types.Mixed }, // Can be string or number
      unit: { type: String },
    },
    currentPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 1 },
  },
  { _id: false },
) // Don't create separate _id for cart items

const CartSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    items: [itemSchema],
  },
  { timestamps: true },
)

export default mongoose.model("Cart", CartSchema)
