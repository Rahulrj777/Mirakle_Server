import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

export const addToCart = async (req, res) => {
  try {
    const { productId, variantId, quantity } = req.body;
    const userId = req.userId;

    console.log("🛒 AddToCart Request:", { userId, productId, variantId, quantity });

    if (!productId || !variantId || !userId) {
      return res.status(400).json({ message: "Invalid item data" });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const variant = product.variants.id(variantId);
    if (!variant) {
      return res.status(404).json({ message: "Variant not found" });
    }

    let userCart = await Cart.findOne({ userId });

    if (!userCart) {
      userCart = new Cart({ userId, items: [] });
    }

    const existingItem = userCart.items.find(
      (item) =>
        item.productId.toString() === productId &&
        item.variantId === variantId
    );

    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      userCart.items.push({ productId, variantId, quantity });
    }

    await userCart.save();

    res.status(200).json({ message: "Added to cart", cart: userCart });
  } catch (error) {
    console.error("❌ AddToCart Error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
