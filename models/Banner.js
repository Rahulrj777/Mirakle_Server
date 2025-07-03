import mongoose from 'mongoose';

const bannerSchema = new mongoose.Schema({
  type: { type: String, required: true },
  imageUrl: { type: String },
  hash: { type: String },
  title: { type: String },
  price: Number,
  oldPrice: Number,
  discountPercent: Number,
  weight: {
    value: Number,
    unit: String
  },
  productIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }]
}, { timestamps: true });

export default mongoose.model('Banner', bannerSchema);
