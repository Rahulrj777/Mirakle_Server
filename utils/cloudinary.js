// This file is for backend use only. Do not import into frontend.
import { v2 as cloudinary } from "cloudinary"
const streamifier = require("streamifier")

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
})

const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream({ folder: "mirakle_products" }, (error, result) => {
      if (error) return reject(error)
      resolve({ url: result.secure_url, public_id: result.public_id })
    })
    streamifier.createReadStream(fileBuffer).pipe(uploadStream)
  })
}

const deleteFromCloudinary = (publicId) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.destroy(publicId, (error, result) => {
      if (error) return reject(error)
      resolve(result)
    })
  })
}

export { uploadToCloudinary, deleteFromCloudinary }

export default cloudinary
