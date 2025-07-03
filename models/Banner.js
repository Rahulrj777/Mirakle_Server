import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  type: { type: String, required: true },
  imageUrl: { type: String },
  hash: { type: String }, // Only for uploaded images, not product-based banners
  title: { type: String },
  price: Number,
  oldPrice: Number,
  discountPercent: Number,
  weight: {
    value: Number,
    unit: String
  },
  // New fields for product-based banners
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  selectedVariantIndex: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

export default mongoose.model('Banner', bannerSchema);