import OfferBanner from '../models/OfferBanner.js';
import cloudinary from '../utils/cloudinary.js';

export const uploadOfferBanner = async (req, res) => {
  try {
    const { title } = req.body;
    const image = req.file?.path;

    if (!image) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: 'mirakle/offer_banners',
    });

    const newBanner = new OfferBanner({
      title,
      image: result.secure_url,
      cloudinary_id: result.public_id,
    });

    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload offer banner', error: err.message });
  }
};

export const getOfferBanners = async (req, res) => {
  try {
    const banners = await OfferBanner.find().sort({ createdAt: -1 });
    res.status(200).json(banners);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch offer banners', error: err.message });
  }
};

export const deleteOfferBanner = async (req, res) => {
  try {
    const banner = await OfferBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    await cloudinary.uploader.destroy(banner.cloudinary_id);
    await banner.deleteOne();

    res.status(200).json({ message: 'Offer banner deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete banner', error: err.message });
  }
};
