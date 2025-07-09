import { useParams,useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE } from "../utils/api"; 
import { useDispatch,useSelector } from 'react-redux';
import { addToCart } from '../Redux/cartSlice';
import { axiosWithToken } from '../utils/axiosWithToken';

const ProductDetail = () => {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedImage, setSelectedImage] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const token = localStorage.getItem("token");
  const [loading, setLoading] = useState(true);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cart = useSelector((state) => state.cart.items) || [];
  const user = JSON.parse(localStorage.getItem("mirakleUser"));

  useEffect(() => {
    console.log("Cart Items:", cart);
  }, [cart]);

  useEffect(() => {
    if (id) {
      fetchProduct();
      fetchRelated();
    }
  }, [id]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [id]);


const fetchProduct = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/products/all-products`);
    const found = res.data.find(p => p._id === id);

    if (found) {
      setProduct(found);
      setSelectedImage(found.images?.others?.[0]);
      if (found.variants.length > 0) {
        setSelectedVariant(found.variants[0]);
      }

      // ✅ Pre-fill rating/comment if already submitted
      if (found.reviews?.length > 0 && user) {
        const existing = found.reviews.find(
          (r) => r.user === user.userId || r.user === user._id
        );
        if (existing) {
          setRating(existing.rating);
          setComment(existing.comment);
        } else {
          setRating(0);
          setComment('');
        }
      } else {
        setRating(0);
        setComment('');
      }
    }
  } catch (err) {
    console.error("Error fetching product:", err);
  }
};

  const handleSizeClick = (variant) => setSelectedVariant(variant);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!rating || !comment) return setError("Please provide both star and review.");

    try {
      await axiosWithToken().post(`/products/${id}/review`, { rating, comment });
      setRating(0); setComment('');
      fetchProduct();
    } catch (err) {
      setError(err.response?.data?.message || "Review failed");
    }
  };

  const fetchRelated = async () => {
  try {
    const res = await axios.get(`${API_BASE}/api/products/related/${id}`);
    setRelatedProducts(res.data);
  } catch (err) { 
    console.error("Failed to fetch related products", err);
  }
};

  const avgRating = product?.reviews?.length > 0
    ? (product.reviews.reduce((acc, r) => acc + r.rating, 0) / product.reviews.length).toFixed(1)
    : 0;


  if (!product || !selectedVariant) return <div className="text-center mt-20">Loading...</div>;

  const price = selectedVariant.price;
  const discount = selectedVariant.discountPercent || 0;
  const finalPrice = (price - (price * discount / 100)).toFixed(2);

 const handleAddToCart = async (product) => {
  const userData = JSON.parse(localStorage.getItem("mirakleUser"));
  const token = userData?.token;

  if (!token) {
    alert("Please login to add items to cart");
    navigate("/login_signup");
    return;
  }

  const productToAdd = {
    _id: product._id,
    title: product.title,
    images: product.images,
    weight: {
      value: selectedVariant?.weight?.value || selectedVariant?.size,
      unit: selectedVariant?.weight?.unit || (selectedVariant?.size ? "size" : "unit")

    },
    currentPrice: parseFloat(finalPrice),
    quantity: 1,
  };

  try {
    dispatch(addToCart(productToAdd));

    await axiosWithToken().post('/cart/add', {
      item: productToAdd
    });

  } catch (err) {
    console.error("❌ Add to cart failed:", err);
    alert("Something went wrong while syncing cart.");
  }
};

  const handleBuyNow = async () => {
    const userData = JSON.parse(localStorage.getItem("mirakleUser"));
    const token = userData?.token;

    if (!token) {
      alert("Please login to proceed with purchase");
      navigate("/login_signup");
      return;
    }

    const productToAdd = {
      _id: product._id,
      title: product.title,
      images: product.images,
      weight: {
        value: selectedVariant?.weight?.value || selectedVariant?.size,
        unit: selectedVariant?.weight?.unit || "unit",
      },
      currentPrice: parseFloat(finalPrice),
    };

    try {
      localStorage.setItem("buyNowProduct", JSON.stringify(productToAdd));
      navigate("/checkout", {
        state: { mode: "buy-now" },
      });

     await axiosWithToken().post('/cart', {
      items: [{ ...productToAdd, quantity: 1 }],
    });
    } catch (err) {
      console.error("❌ Buy Now cart sync failed:", err);
      alert("Something went wrong while processing Buy Now");
    }
  };

  const currentUserReview = product?.reviews?.find(
  (r) => r.user === user?.userId || r.user === user?._id
);

const otherReviews = product?.reviews?.filter(
  (r) => r.user !== (user?.userId || user?._id)
);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="grid md:grid-cols-2 gap-8">
        {/* Image Preview */}
        <div>
          <img src={`${API_BASE}${selectedImage}`} className="w-full h-[400px] object-contain rounded" />
          <div className="flex gap-2 mt-2">
            {product.images?.others?.map((img, i) => (
              <img key={i} src={`${API_BASE}${img}`}
                onClick={() => setSelectedImage(img)}
                className={`w-20 h-20 object-cover border cursor-pointer ${selectedImage === img ? 'border-blue-500' : ''}`} />
            ))}
          </div>
        </div>

        {/* Product Info */}
        <div>
          <h1 className="text-2xl font-bold">{product.title}</h1>
          <div className="flex items-center gap-2 my-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <svg
                key={star}
                xmlns="http://www.w3.org/2000/svg"
                fill={avgRating >= star ? "#facc15" : "none"}
                viewBox="0 0 24 24"
                stroke="#facc15"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.973a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.973c.3.921-.755 1.688-1.54 1.118l-3.387-2.46a1 1 0 00-1.175 0l-3.387 2.46c-.784.57-1.838-.197-1.539-1.118l1.287-3.973a1 1 0 00-.364-1.118l-3.387-2.46c-.784-.57-.38-1.81.588-1.81h4.18a1 1 0 00.951-.69l1.286-3.973z"
                />
              </svg>
            ))}
            <span className="text-sm text-gray-700">
              {avgRating} / 5 ({product.reviews?.length || 0} review{product.reviews?.length !== 1 ? 's' : ''})
            </span>
          </div>
          <div className="text-3xl font-bold text-green-600 mb-2">
            ₹{finalPrice}
            {discount > 0 && (
              <>
                <span className="text-gray-400 line-through text-sm ml-3">₹{price}</span>
                <span className="text-sm text-red-500 ml-2">{discount}% OFF</span>
              </>
            )}
          </div>
          <div className="mt-4">
            <p className="font-medium mb-1">Select Size:</p>
            <div className="flex gap-2 flex-wrap">
              {product.variants.map((v, i) => (
                <button key={i}
                  onClick={() => handleSizeClick(v)}
                  className={`px-4 py-1 border rounded-full cursor-pointer ${v.size === selectedVariant.size ? 'bg-green-600 text-white' : 'hover:bg-gray-200'}`}>
                  {v.size}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-6 flex gap-4">
            <button onClick={() => handleAddToCart(product)} className="bg-orange-500 text-white px-6 py-2 rounded cursor-pointer">
              Add to Cart
            </button>
            <button onClick={handleBuyNow} className="bg-green-600 text-white px-6 py-2 rounded cursor-pointer">
              Buy Now
            </button>
          </div>
          <div className="mt-6 text-sm text-gray-800 whitespace-pre-line">{product.description}</div>
        </div>
      </div>

      {/* Product Details Section */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-2">Product Details</h2>
        {product.details && typeof product.details === 'object' ? (
            <ul className="text-gray-700 text-sm list-disc pl-5">
            {Object.entries(product.details).map(([key, value]) => (
                <li key={key}>
                <strong className="capitalize">{key}</strong>: {value}
                </li>
            ))}
            </ul>
        ) : (
            <p className="text-gray-500 text-sm">No additional info</p>
        )}
      </div>

      {/* ⭐ Ratings & Reviews */}
      <div className="mt-10">
        <h2 className="text-xl font-bold mb-4">Ratings & Reviews</h2>

        {/* ✅ Review submission */}
        {token ? (
          <form onSubmit={handleSubmit} className="space-y-4 mb-6 bg-gray-50 p-4 rounded shadow">
            <div>
              <label className="block text-sm font-medium mb-1">Your Rating:</label>
              <div className="flex items-center space-x-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <svg
                    key={star}
                    onClick={() => setRating(star)}
                    xmlns="http://www.w3.org/2000/svg"
                    fill={rating >= star ? "#facc15" : "none"}
                    viewBox="0 0 24 24"
                    stroke="#facc15"
                    className="w-6 h-6 cursor-pointer transition"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.973a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.973c.3.921-.755 1.688-1.54 1.118l-3.387-2.46a1 1 0 00-1.175 0l-3.387 2.46c-.784.57-1.838-.197-1.539-1.118l1.287-3.973a1 1 0 00-.364-1.118l-3.387-2.46c-.784-.57-.38-1.81.588-1.81h4.18a1 1 0 00.951-.69l1.286-3.973z"
                    />
                  </svg>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Your Review:</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 p-2 rounded"
                placeholder="Write your honest feedback..."
              />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
            >
              Submit Review
            </button>
          </form>
        ) : (
          <p className="text-gray-500">Please login to rate & review.</p>
        )}

        {/* ✅ Display reviews */}
        <div className="space-y-4">
          {currentUserReview && (
            <div className="border p-4 rounded bg-blue-50 shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <div className="flex gap-2 items-center">
                  <p className="text-sm font-semibold text-blue-800">Your Review</p>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        xmlns="http://www.w3.org/2000/svg"
                        fill={currentUserReview.rating >= star ? "#facc15" : "none"}
                        viewBox="0 0 24 24"
                        stroke="#facc15"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.973a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.973c.3.921-.755 1.688-1.54 1.118l-3.387-2.46a1 1 0 00-1.175 0l-3.387 2.46c-.784.57-1.838-.197-1.539-1.118l1.287-3.973a1 1 0 00-.364-1.118l-3.387-2.46c-.784-.57-.38-1.81.588-1.81h4.18a1 1 0 00.951-.69l1.286-3.973z"
                        />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(currentUserReview.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-gray-700 mt-1">{currentUserReview.comment}</p>
            </div>
          )}

          {otherReviews.length === 0 && !currentUserReview && (
            <p className="text-gray-400 italic">No reviews yet. Be the first to review this product.</p>
          )}

          {otherReviews.map((r, i) => (
            <div key={i} className="border p-4 rounded bg-white shadow-sm">
              <div className="flex justify-between items-center mb-1">
                <div className="flex gap-2 items-center">
                  <p className="text-sm font-semibold text-gray-800">{r.name || 'User'}</p>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        xmlns="http://www.w3.org/2000/svg"
                        fill={r.rating >= star ? "#facc15" : "none"}
                        viewBox="0 0 24 24"
                        stroke="#facc15"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="1.5"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.973a1 1 0 00.95.69h4.18c.969 0 1.371 1.24.588 1.81l-3.387 2.46a1 1 0 00-.364 1.118l1.287 3.973c.3.921-.755 1.688-1.54 1.118l-3.387-2.46a1 1 0 00-1.175 0l-3.387 2.46c-.784.57-1.838-.197-1.539-1.118l1.287-3.973a1 1 0 00-.364-1.118l-3.387-2.46c-.784-.57-.38-1.81.588-1.81h4.18a1 1 0 00.951-.69l1.286-3.973z"
                        />
                      </svg>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  {new Date(r.createdAt).toLocaleString()}
                </p>
              </div>
              <p className="text-sm text-gray-700 mt-1">{r.comment}</p>
            </div>
          ))}
        </div>
      </div>
      {relatedProducts.length > 0 && (
        <div className="mt-10">
          <h2 className="text-xl font-bold mb-4">Related Products</h2>
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
            {relatedProducts.map((p) => {
              const mainImage = p.images?.others?.[0] || "/placeholder.jpg";
              const firstVariant = p.variants?.[0];
              const price = firstVariant?.price || 0;
              const discount = firstVariant?.discountPercent || 0;
              const finalPrice = (price - (price * discount / 100)).toFixed(2);

              return (
                <div
                  key={p._id}
                  onClick={() => navigate(`/product/${p._id}`)}
                  className="cursor-pointer border rounded shadow-sm p-3 hover:shadow-md transition duration-200"
                >
                  <img
                    src={`${API_BASE}${mainImage}`}
                    alt={p.title}
                    className="w-full h-48 object-cover rounded mb-2 hover:scale-105 transition-transform duration-200"
                  />
                  <h4 className="text-sm font-semibold">{p.title}</h4>
                  <p className="text-green-600 font-bold">₹{finalPrice}</p>
                  {discount > 0 && (
                    <p className="text-xs text-gray-400 line-through">₹{price}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail; 