import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      // ✅ MODIFIED: title is no longer required at the schema level.
      // It will be conditionally required in the route handler.
      trim: true,
    },
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

// ✅ NEW: Add a compound unique index for category banners to prevent duplicate titles
bannerSchema.index({ type: 1, title: 1 }, { unique: true, partialFilterExpression: { type: "category" } })

export default mongoose.model("Banner", bannerSchema)
