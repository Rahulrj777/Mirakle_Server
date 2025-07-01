import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  images: {
    others: [{ type: String }],
  },
  description: { type: String, default: '' },
  variants: [
    {
      size: { type: String, required: true },
      price: { type: Number, required: true },
      stock: { type: Number, default: 0 },
      discountPercent: { type: Number },
    },
  ],
  discountPercent: { type: Number },
  oldPrice: { type: Number },
  weight: {
    value: { type: Number },
    unit: { type: String, enum: ['g', 'ml', 'li'], default: 'g' },
  },
  isOutOfStock: { type: Boolean, default: false },
  details: { type: mongoose.Schema.Types.Mixed, default: {} },
});

const Product = mongoose.model('Product', productSchema);

// ✅ EXPORT AS DEFAULT
export default Product;
