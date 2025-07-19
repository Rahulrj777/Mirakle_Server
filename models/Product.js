const mongoose = require("mongoose")

const productVariantSchema = new mongoose.Schema({
  size: { type: String, required: true },
  color: { type: String, required: true },
  price: { type: Number, required: true },
  discountPercent: { type: Number, default: 0 },
  stock: { type: Number, required: true },
  sku: { type: String, unique: true, sparse: true }, // SKU can be optional but unique if present
})

const productSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, required: true },
  productType: { type: String, required: true, trim: true }, // e.g., "Electronics", "Clothing"
  category: { type: String, trim: true }, // e.g., "Smartphones", "T-shirts"
  subCategory: { type: String, trim: true },
  brand: { type: String, trim: true },
  variants: [productVariantSchema], // Array of variants
  images: {
    thumbnail: { url: String, public_id: String },
    others: [{ url: String, public_id: String }],
  },
  keywords: [{ type: String, trim: true }], // For search optimization
  isFeatured: { type: Boolean, default: false },
  isNewArrival: { type: Boolean, default: false },
  isBestSeller: { type: Boolean, default: false },
  isOutOfStock: { type: Boolean, default: false },
  averageRating: { type: Number, default: 0 },
  numberOfReviews: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Middleware to update `updatedAt` on save
productSchema.pre("save", function (next) {
  this.updatedAt = Date.now()
  next()
})

const Product = mongoose.model("Product", productSchema)

module.exports = Product
