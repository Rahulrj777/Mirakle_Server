import mongoose from "mongoose"

const offerBannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    imageUrl: { type: String, required: true },
    public_id: { type: String, required: true },
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    slot: { type: String, enum: ["left", "right"], required: true, unique: true },
    isActive: { type: Boolean, default: true },
    // ✅ NEW: Fields for linking to products or categories
    linkedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    linkedCategory: {
      type: String,
      trim: true,
      default: null,
    },
    linkedDiscountUpTo: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model("OfferBanner", offerBannerSchema)
