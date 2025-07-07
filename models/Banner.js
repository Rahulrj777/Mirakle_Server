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

// NO INDEXES for now to avoid conflicts
const Banner = mongoose.model("Banner", bannerSchema)
export default Banner
