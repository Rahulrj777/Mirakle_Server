// Add these fields to your Banner schema
const bannerSchema = new mongoose.Schema({
  type: { type: String, required: true },
  imageUrl: { type: String },
  hash: { type: String },
  title: { type: String }, // This will be auto-populated from selected product
  price: Number,
  oldPrice: Number,
  discountPercent: Number,
  weight: {
    value: Number,
    unit: String
  },
  // New fields for product selection
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  },
  selectedVariantIndex: {
    type: Number,
    default: 0
  }
}, { timestamps: true });