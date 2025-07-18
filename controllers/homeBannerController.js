import HomeBanner from '../models/HomeBanner.js';
import cloudinary from '../utils/cloudinary.js';

export const uploadHomeBanner = async (req, res) => {
  try {
    const { title } = req.body;
    const image = req.file?.path;

    if (!image) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: 'mirakle/home_banners',
    });

    const newBanner = new HomeBanner({
      title,
      image: result.secure_url,
      cloudinary_id: result.public_id,
    });

    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload banner', error: err.message });
  }
};

export const getHomeBanners = async (req, res) => {
  try {
    const banners = await HomeBanner.find().sort({ createdAt: -1 });
    res.status(200).json(banners);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch banners', error: err.message });
  }
};

export const deleteHomeBanner = async (req, res) => {
  try {
    const banner = await HomeBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    await cloudinary.uploader.destroy(banner.cloudinary_id);
    await banner.deleteOne();

    res.status(200).json({ message: 'Banner deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete banner', error: err.message });
  }
};
