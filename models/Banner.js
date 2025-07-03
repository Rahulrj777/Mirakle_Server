import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    type: { type: String, required: true },
    imageUrl: { type: String },
    hash: { type: String },
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

// Create a compound index for hash and type, but only when hash exists
bannerSchema.index(
  { hash: 1, type: 1 },
  {
    unique: true,
    sparse: true, // Only create index when hash field exists
    partialFilterExpression: { hash: { $exists: true, $ne: null } },
  },
)

const Banner = mongoose.model("Banner", bannerSchema)

export default Banner
