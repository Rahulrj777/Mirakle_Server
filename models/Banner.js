import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: true,
      enum: ["slider", "side", "offer", "product-type"], // allowed types
    },
    imageUrl: {
      type: String,
      default: "", // empty by default for product-based banners
    },
    hash: {
      type: String,
      default: null, // allow null
    },
    title: {
      type: String,
      default: "",
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
    },
    selectedVariantIndex: {
      type: Number,
      default: 0,
    },
    price: {
      type: Number,
      default: 0,
    },
    oldPrice: {
      type: Number,
      default: 0,
    },
    discountPercent: {
      type: Number,
      default: 0,
    },
    weight: {
      value: { type: Number },
      unit: { type: String },
    },
  },
  {
    timestamps: true,
  }
)

const Banner = mongoose.model("Banner", bannerSchema)

export default Banner
