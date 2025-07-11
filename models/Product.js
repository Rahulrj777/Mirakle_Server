import mongoose from 'mongoose';

const variantSchema = new mongoose.Schema({
  size: { type: String },
  weight: {
    value: { type: Number, default: 0 },
    unit: { type: String, enum: ['g', 'ml', 'li'], default: 'g' },
  },
  price: { type: Number },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

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
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    reviews: [reviewSchema],
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
