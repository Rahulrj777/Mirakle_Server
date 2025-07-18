import mongoose from "mongoose";

const categoryBannerSchema = new mongoose.Schema({
  title: { type: String, required: true },
  imageUrl: { type: String, required: true },
  public_id: { type: String, required: true },
}, { timestamps: true });

export default mongoose.model("CategoryBanner", categoryBannerSchema);
