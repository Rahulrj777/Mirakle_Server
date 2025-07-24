import mongoose from "mongoose"

const itemSchema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    variantId: { type: String, required: true }, // ✅ Changed to String to handle our generated IDs
    title: { type: String, required: true },
    images: {
      others: [
        {
          url: { type: String }, // ✅ Fixed: Define proper structure for images
          _id: false,
        },
      ],
    },
    size: { type: String },
    weight: {
      value: { type: mongoose.Schema.Types.Mixed },
      unit: { type: String },
    },
    originalPrice: { type: Number }, // ✅ Added missing field
    discountPercent: { type: Number, default: 0 }, // ✅ Added missing field
    currentPrice: { type: Number, required: true },
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
