import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  size: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  discountPercent: { type: Number, default: 0 },
}, { _id: false });

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    images: {
      others: [{ type: String }],
    },

    description: { type: String, default: '' },

    variants: [variantSchema],

    discountPercent: { type: Number, default: 0 }, // Global discount

    oldPrice: { type: Number, default: 0 },

    weight: {
      value: { type: Number, default: 0 },
      unit: { type: String, enum: ['g', 'ml', 'li'], default: 'g' },
    },

    isOutOfStock: { type: Boolean, default: false },

    details: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: { type: String, enum: ['active', 'inactive'], default: 'active' }, // ✅ Useful for admin filtering
  },
  {
    timestamps: true,
  }
);

productSchema.index({ title: 1 }); // ✅ Index for faster search by title

const Product = mongoose.model('Product', productSchema);
export default Product;
