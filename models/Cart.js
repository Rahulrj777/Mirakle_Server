import mongoose from "mongoose"

const itemSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    variantId: { type: String, required: true },
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
  },
  { timestamps: true },
)

export default mongoose.model("Cart", CartSchema)
