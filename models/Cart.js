router.post('/', authMiddleware, async (req, res) => {
  const { items } = req.body;
  const userId = req.user.userId;

  let cart = await Cart.findOne({ userId });

  if (!cart) {
    // Create new cart
    cart = new Cart({ userId, items });
  } else {
    for (const newItem of items) {
      const index = cart.items.findIndex(i => i._id === newItem._id);

      if (index !== -1) {
        // Item exists: increase quantity
        cart.items[index].quantity += newItem.quantity || 1;
      } else {
        // Add new item
        cart.items.push({ ...newItem, quantity: newItem.quantity || 1 });
      }
    }
  }

  await cart.save();
  res.json({ message: 'Cart updated', cart });
});
