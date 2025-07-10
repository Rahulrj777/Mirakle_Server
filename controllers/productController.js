// controllers/productController.js
import Product from '../models/Product.js';

export const likeReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const userId = req.user.id;

    const product = await Product.findById(productId);
    const review = product.reviews.id(reviewId);

    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.likes.includes(userId)) {
      review.likes.pull(userId); // Unlike
    } else {
      review.dislikes.pull(userId);
      review.likes.push(userId);
    }

    await product.save();
    res.status(200).json({ message: "Liked/unliked", review });
  } catch (err) {
    console.error("Like Review Error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const dislikeReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params;
    const userId = req.user.id;

    const product = await Product.findById(productId);
    const review = product.reviews.id(reviewId);

    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.dislikes.includes(userId)) {
      review.dislikes.pull(userId);
    } else {
      review.likes.pull(userId);
      review.dislikes.push(userId);
    }

    await product.save();
    res.status(200).json({ message: "Disliked/undisliked", review });
  } catch (err) {
    console.error("Dislike Review Error:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};
