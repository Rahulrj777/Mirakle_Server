import ProductTypeBanner from '../models/ProductTypeBanner.js';
import cloudinary from '../utils/cloudinary.js';

export const uploadProductTypeBanner = async (req, res) => {
  try {
    const { title, productId, price, oldPrice, discountPercent, size, productType } = req.body;
    const image = req.file?.path;

    if (!image || !productId || !price) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: 'mirakle/product_type_banners',
    });

    const newBanner = new ProductTypeBanner({
      title,
      productId,
      price,
      oldPrice,
      discountPercent,
      size,
      productType,
      image: result.secure_url,
      cloudinary_id: result.public_id,
    });

    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload banner', error: err.message });
  }
};

export const getProductTypeBanners = async (req, res) => {
  try {
    const banners = await ProductTypeBanner.find().sort({ createdAt: -1 });
    res.status(200).json(banners);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch banners', error: err.message });
  }
};

export const deleteProductTypeBanner = async (req, res) => {
  try {
    const banner = await ProductTypeBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    await cloudinary.uploader.destroy(banner.cloudinary_id);
    await banner.deleteOne();

    res.status(200).json({ message: 'Banner deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete banner', error: err.message });
  }
};
