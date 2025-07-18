import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["homebanner", "category", "product-type"],
      default: "homebanner",
    },
    imageUrl: {
      type: String,
      required: true,
    },
    public_id: {
      type: String, // For Cloudinary images (homebanner, category)
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    discountPercent: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    oldPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    weight: {
      value: { type: Number, default: 0 },
      unit: { type: String, enum: ["g", "ml", "li", "kg"], default: "g" },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // ❌ REMOVED: percentage field (now in OfferBanner)
    // ❌ REMOVED: slot field (now in OfferBanner)
  },
  {
    timestamps: true,
  },
)

// Keep the compound unique index for category banners
bannerSchema.index({ type: 1, title: 1 }, { unique: true, partialFilterExpression: { type: "category" } })

export default mongoose.model("Banner", bannerSchema)
