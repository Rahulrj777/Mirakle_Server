import CategoryBanner from '../models/CategoryBanner.js';
import cloudinary from '../utils/cloudinary.js';

export const uploadCategoryBanner = async (req, res) => {
  try {
    const { title, category } = req.body;
    const image = req.file?.path;

    if (!image || !category) {
      return res.status(400).json({ message: 'Missing image or category' });
    }

    const result = await cloudinary.uploader.upload(image, {
      folder: 'mirakle/category_banners',
    });

    const newBanner = new CategoryBanner({
      title,
      category,
      image: result.secure_url,
      cloudinary_id: result.public_id,
    });

    await newBanner.save();
    res.status(201).json(newBanner);
  } catch (err) {
    res.status(500).json({ message: 'Failed to upload category banner', error: err.message });
  }
};

export const getCategoryBanners = async (req, res) => {
  try {
    const banners = await CategoryBanner.find().sort({ createdAt: -1 });
    res.status(200).json(banners);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch category banners', error: err.message });
  }
};

export const deleteCategoryBanner = async (req, res) => {
  try {
    const banner = await CategoryBanner.findById(req.params.id);
    if (!banner) return res.status(404).json({ message: 'Banner not found' });

    await cloudinary.uploader.destroy(banner.cloudinary_id);
    await banner.deleteOne();

    res.status(200).json({ message: 'Category banner deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete banner', error: err.message });
  }
};
