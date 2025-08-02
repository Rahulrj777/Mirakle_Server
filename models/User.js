// models/user.js
import mongoose from "mongoose"

const addressSchema = new mongoose.Schema(
  {
    name: String,
    phone: { type: String, required: true },
    line1: String,
    city: String,
    pincode: String,
    landmark: String,
    type: { type: String, default: "HOME" },
  },
  { _id: true }
);

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6 },
  isAdmin: { type: Boolean, default: false },
  otp: { type: String },
  otpExpires: { type: Date },
  isVerified: { type: Boolean, default: false },
  addresses: [addressSchema], 
}, {
  timestamps: true,
});


export default mongoose.model("User", userSchema)
