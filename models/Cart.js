// File: models/Cart.js
import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  productId: mongoose.Schema.Types.ObjectId,
  title: String,
  images: Object,
  weight: {
    value: String,
    unit: String,
  },
  currentPrice: Number,
  quantity: Number,
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  items: [itemSchema],
}, { timestamps: true });

export default mongoose.model("Cart", cartSchema);
