import mongoose from "mongoose"

const offerBannerSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: true,
    },
    public_id: {
      type: String, // For Cloudinary images
      required: true,
    },
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    slot: {
      type: String,
      enum: ["left", "right"],
      required: true,
      unique: true, // Ensure only one banner per slot
    },
    // Linking options (only one should be present at a time)
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
      min: 0,
      max: 100,
      default: null, // Use null to indicate not set, 0 is a valid discount
    },
    linkedUrl: {
      type: String,
      trim: true,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
)

export default mongoose.model("OfferBanner", offerBannerSchema)
