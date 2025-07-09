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
  quantity: { type: Number, required: true, min: 1 },
}, { _id: false });

const cartSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
    unique: true
  },
  items: [itemSchema],
}, {
  timestamps: true,
  toJSON: { virtuals: true }, 
  toObject: { virtuals: true }  
});

cartSchema.virtual('totalPrice').get(function () {
  return this.items.reduce((total, item) => total + item.currentPrice * item.quantity, 0);
});

export default mongoose.model("Cart", cartSchema);
