import mongoose from "mongoose"

const productSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    variants: [
      {
        size: { type: String, required: true },
        price: { type: Number, required: true },
        discountPercent: { type: Number, default: 0 },
        stock: { type: Number, default: 0 },
      },
    ],
    images: {
      others: [{ type: String }],
    },
    description: { type: String },
    details: { type: Object },
    keywords: [{ type: String }], // 🚨 NEW: Keywords array
    isOutOfStock: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

// 🚨 NEW: Create text index for fuzzy search
productSchema.index({
  title: "text",
  keywords: "text",
  description: "text",
})

const Product = mongoose.model("Product", productSchema)
export default Product
