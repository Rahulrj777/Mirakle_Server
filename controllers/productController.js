import Product from '../models/Product.js';

// GET /api/products/search?query=yourSearch
export const searchProducts = async (req, res) => {
  try {
    const query = req.query.query?.trim();

    // Prevent short queries to avoid performance and regex issues
    if (!query || query.length < 2) {
      return res.status(400).json({ message: "Search query too short." });
    }

    const regex = new RegExp(query, "i"); // case-insensitive

    const products = await Product.find({
      $or: [
        { title: { $regex: regex } },
        { description: { $regex: regex } },
        { keywords: { $in: [regex] } }, // if keywords is an array
      ],
    });

    res.json(products);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Server error during product search." });
  }
};
