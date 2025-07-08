import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  size: { type: String },
  weight: {
    value: { type: Number, default: 0 },
    unit: { type: String, enum: ['g', 'ml', 'li'], default: 'g' },
  },
  price: { type: Number },
}, { _id: false });

// Now define the main product schema
const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    images: {
      others: [{ type: String }],
    },

    description: { type: String, default: '' },

    variants: [variantSchema],

    discountPercent: { type: Number, default: 0 },

    oldPrice: { type: Number, default: 0 },

    weight: {
      value: { type: Number, default: 0 },
      unit: { type: String, enum: ['g', 'ml', 'li'], default: 'g' },
    },

    isOutOfStock: { type: Boolean, default: false },

    details: { type: mongoose.Schema.Types.Mixed, default: {} },

    status: { type: String, enum: ['active', 'inactive'], default: 'active' },

    keywords: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
