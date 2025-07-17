// models/OfferBanner.js
import mongoose from 'mongoose';

const offerBannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  percentage: { type: String }, // Optional
  imageUrl: { type: String, required: true },
    slot: { type: String, enum: ["left", "right"], required: true }, 
}, { timestamps: true });

export default mongoose.model('OfferBanner', offerBannerSchema);
