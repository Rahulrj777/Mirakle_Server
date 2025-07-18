import mongoose from "mongoose"

const offerBannerSchema = new mongoose.Schema(
  {
    title: {type: String,required: true,trim: true,},
    imageUrl: {type: String,required: true,},
    public_id: {type: String,required: true,},
    percentage: {type: Number, default: 0,min: 0,max: 100,},
    slot: {type: String,enum: ["left", "right"],required: true,unique: true},
    isActive: {type: Boolean,default: true,},
  },
  {
    timestamps: true,
  },
)

export default mongoose.model("OfferBanner", offerBannerSchema)
