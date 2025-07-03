import mongoose from "mongoose"

const bannerSchema = new mongoose.Schema(
  {
    type: { 
      type: String, 
      required: true,
      enum: ['slider', 'side', 'offer', 'product-type']
    },
    imageUrl: { type: String },
    hash: { type: String }, // Remove unique constraint from here
    title: { type: String },
    productId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "Product" 
    },
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

// Create a CONDITIONAL unique index
// Only apply unique constraint to regular banners (with hash)
bannerSchema.index(
  { hash: 1, type: 1 }, 
  { 
    unique: true,
    partialFilterExpression: { hash: { $ne: null } } // Only apply when hash is not null
  }
)

const Banner = mongoose.model("Banner", bannerSchema)

export default Banner