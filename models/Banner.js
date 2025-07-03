import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    imageUrl: { type: String },
    hash: { type: String }, // No unique constraint here
    title: { type: String },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    selectedVariantIndex: { type: Number, default: 0 },
    price: { type: Number },
    oldPrice: { type: Number },
    discountPercent: { type: Number },
    weight: {
      value: { type: Number },
      unit: { type: String },
    },
  },
  {
    timestamps: true,
  },
)

// Only add unique constraint for regular banners (not product banners)
bannerSchema.index(
  { hash: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: { hash: { $ne: null } }, // Only apply when hash is not null
  },
)

const Banner = mongoose.model("Banner", bannerSchema)

export default Banner
