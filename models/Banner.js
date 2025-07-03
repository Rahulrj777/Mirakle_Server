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

// FIXED: Only create unique index for regular banners that actually have a hash
// Product banners don't have hash, so they shouldn't be part of this index
bannerSchema.index(
  { hash: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      hash: { $exists: true, $ne: null, $ne: "" }, // Only when hash actually exists and is not empty
    },
  },
)

const Banner = mongoose.model("Banner", bannerSchema)

export default Banner
