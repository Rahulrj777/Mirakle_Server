import mongoose from "mongoose";

const bannerSchema = new mongoose.Schema(
  {
    imageUrl: { type: String, required: true },

    type: {
      type: String,
      enum: ['slider', 'side', 'offer', 'product-type'],
      required: true,
    },

    hash: { type: String, required: true },

    title: { type: String, default: "" },

    price: {
      type: Number,
      default: 0,
    },

    oldPrice: {
      type: Number,
      default: 0,
    },

    discountPercent: {
      type: Number,
      default: 0,
    },

    weight: {
      value: { type: Number, default: 0 },
      unit: { type: String, enum: ['g', 'ml', 'li'], default: 'g' },
    },
  },
  {
    timestamps: true, // ✅ adds createdAt & updatedAt fields
  }
);

// ✅ Prevent duplicate hash within the same type
bannerSchema.index({ hash: 1, type: 1 }, { unique: true });

export default mongoose.model("Banner", bannerSchema);
