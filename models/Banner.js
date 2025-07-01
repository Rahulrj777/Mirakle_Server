import mongoose from "mongoose"; 

const bannerSchema = new mongoose.Schema({
  imageUrl: { type: String, required: true },
  type: {
    type: String,
    enum: ['slider', 'side', 'offer', 'product-type'],
    required: true,
  },
  hash: { type: String, required: true },
  title: { type: String, default: "" },
  price: { type: Number, default: 0 }, // New Price
  oldPrice: { type: Number, default: 0 }, // ✅ New Field
  discountPercent: { type: Number, default: 0 }, // ✅ New Field
  weight: {
    value: { type: Number, default: 0 },
    unit: { type: String, enum: ['g', 'ml', 'li'], default: 'g' },
  },
});

bannerSchema.index({ hash: 1, type: 1 }, { unique: true });

export default mongoose.model("Banner", bannerSchema); 