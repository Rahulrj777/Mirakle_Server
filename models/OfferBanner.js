// models/OfferBanner.js
const mongoose = require('mongoose');

const offerBannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  percentage: { type: String }, // Optional
  imageUrl: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model('OfferBanner', offerBannerSchema);
