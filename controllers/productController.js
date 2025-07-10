import Product from "../models/Product.js"

export const likeReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params
    const userId = req.user.id

    console.log("Like request:", { productId, reviewId, userId })

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    const review = product.reviews.id(reviewId)
    if (!review) return res.status(404).json({ message: "Review not found" })

    // Initialize arrays if they don't exist
    if (!review.likes) review.likes = []
    if (!review.dislikes) review.dislikes = []

    const hasLiked = review.likes.includes(userId)
    const hasDisliked = review.dislikes.includes(userId)

    if (hasLiked) {
      // Remove like
      review.likes.pull(userId)
    } else {
      // Add like and remove dislike if exists
      if (hasDisliked) {
        review.dislikes.pull(userId)
      }
      review.likes.push(userId)
    }

    await product.save()

    res.status(200).json({
      message: hasLiked ? "Like removed" : "Review liked",
      review: {
        _id: review._id,
        likes: review.likes.length,
        dislikes: review.dislikes.length,
        userLiked: review.likes.includes(userId),
        userDisliked: review.dislikes.includes(userId),
      },
    })
  } catch (err) {
    console.error("Like Review Error:", err)
    res.status(500).json({ message: "Something went wrong" })
  }
}

export const dislikeReview = async (req, res) => {
  try {
    const { productId, reviewId } = req.params
    const userId = req.user.id

    console.log("Dislike request:", { productId, reviewId, userId })

    const product = await Product.findById(productId)
    if (!product) return res.status(404).json({ message: "Product not found" })

    const review = product.reviews.id(reviewId)
    if (!review) return res.status(404).json({ message: "Review not found" })

    // Initialize arrays if they don't exist
    if (!review.likes) review.likes = []
    if (!review.dislikes) review.dislikes = []

    const hasLiked = review.likes.includes(userId)
    const hasDisliked = review.dislikes.includes(userId)

    if (hasDisliked) {
      // Remove dislike
      review.dislikes.pull(userId)
    } else {
      // Add dislike and remove like if exists
      if (hasLiked) {
        review.likes.pull(userId)
      }
      review.dislikes.push(userId)
    }

    await product.save()

    res.status(200).json({
      message: hasDisliked ? "Dislike removed" : "Review disliked",
      review: {
        _id: review._id,
        likes: review.likes.length,
        dislikes: review.dislikes.length,
        userLiked: review.likes.includes(userId),
        userDisliked: review.dislikes.includes(userId),
      },
    })
  } catch (err) {
    console.error("Dislike Review Error:", err)
    res.status(500).json({ message: "Something went wrong" })
  }
}
