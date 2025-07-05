// models/Cart.js
import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      _id: String, // Product ID
      title: String,
      images: Object,
      weight: Object,
      currentPrice: Number,
      quantity: Number,
    }
  ],
}, { timestamps: true });

export default mongoose.model('Cart', cartSchema);
