import mongoose from "mongoose"

const variantSchema = new mongoose.Schema({
  size: { type: String },
  weight: {
    value: { type: Number, default: 0 },
    unit: { type: String, enum: ["g", "ml", "li"], default: "g" },
  },
  price: { type: Number },
  discountPercent: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
}, { _id: false })

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, required: true },
  images: [{ type: String }],
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  dislikes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  createdAt: { type: Date, default: Date.now },
})

const productSchema = new mongoose.Schema({
  title: { type: String, required: true },
  images: {
    others: [{ type: String }],
  },
  description: { type: String, default: "" },
  productType: { type: mongoose.Schema.Types.ObjectId, ref: "ProductType", required: true }, // 🚨 Important line
  variants: [variantSchema],
  discountPercent: { type: Number, default: 0 },
  oldPrice: { type: Number, default: 0 },
  isOutOfStock: { type: Boolean, default: false },
  details: { type: Object, default: {} },
  keywords: [{ type: String }],
  reviews: [reviewSchema],
}, { timestamps: true })

const Product = mongoose.model("Product", productSchema)

export default Product
