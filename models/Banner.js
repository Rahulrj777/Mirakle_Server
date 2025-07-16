import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["offer", "homebanner", "category", "product-type"], default: "homebanner" },
    imageUrl: { type: String, required: true },
    hash: { type: String, index: true, sparse: true }, // ✅ ADD THIS LINE
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
