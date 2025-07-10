// File: models/Cart.js
import mongoose from "mongoose";

const itemSchema = new mongoose.Schema({
  productId:mongoose.Schema.Types.ObjectId,
  title: String,
  images: Object,
  weight: {
    value: String,
    unit: String,
  },
  currentPrice: Number,
  quantity: Number,
});

const CartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  items: { type: Array, default: [] },
}, { timestamps: true });

export default mongoose.model("Cart", cartSchema);