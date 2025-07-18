import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // ✅ UPDATED: type enum to reflect new categories
    type: {
      type: String,
      enum: ["homebanner", "category", "product-type", "offerbanner"],
      default: "homebanner",
    },
    imageUrl: {
      type: String,
      required: true,
    },
    public_id: {
      type: String, // For Cloudinary images (homebanner, category, offerbanner)
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
    // ✅ NEW: Fields for offerbanner type
    percentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    slot: {
      type: String,
      enum: ["left", "right"],
      sparse: true, // Allows null values, but unique for non-null
      unique: true, // Ensures only one banner per slot for offerbanner
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model("Banner", bannerSchema)
