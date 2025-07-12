import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["offer", "main", "side", "product-type"], default: "main" },
    imageUrl: { type: String, required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },
    title: { type: String }, // Added title field
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    price: { type: Number, default: 0, min: 0 },
    oldPrice: { type: Number, default: 0, min: 0 },
    weight: { value: { type: Number, default: 0 }, unit: { type: String, enum: ["g", "ml", "li"], default: "g" } },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model("Banner", bannerSchema)
