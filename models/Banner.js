import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  type: { 
    type: String, 
    required: true,
    enum: ['slider', 'side', 'offer', 'product-type']
  },
  imageUrl: { 
    type: String,
    required: true
  },
  hash: { 
    type: String 
  }, // Only for uploaded images
  title: { 
    type: String,
    default: ''
  },
  price: {
    type: Number,
    default: 0
  },
  oldPrice: {
    type: Number,
    default: 0
  },
  discountPercent: {
    type: Number,
    default: 0
  },
  weight: {
    value: {
      type: Number,
      default: 0
    },
    unit: {
      type: String,
      default: 'g'
    }
  },
  // Product-based banner fields
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  selectedVariantIndex: {
    type: Number,
    default: 0
  }
}, { 
  timestamps: true 
});

// Add indexes for better performance
bannerSchema.index({ type: 1 });
bannerSchema.index({ type: 1, hash: 1 });

export default mongoose.model('Banner', bannerSchema);