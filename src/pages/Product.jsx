import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { useUserAuth } from '../auth/AuthContext';
import { ArrowLeft, Check } from 'lucide-react';

export const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { session } = useUserAuth();
  const { getProductById } = useStore();
  const product = getProductById(id);
  const { addToCart } = useStore();
  const [added, setAdded] = useState(false);
  const [width, setWidth] = useState('');
  const [length, setLength] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState('');

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [id]);

  useEffect(() => {
    if (!product) {
      return;
    }

    setWidth('');
    setLength('');
    setQuantity(1);
    setSelectedVariant(Array.isArray(product.variants) && product.variants.length > 0 ? product.variants[0] : '');
  }, [product]);

  if (!product) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center">
        <h2 className="text-2xl mb-4">Product unavailable.</h2>
        <p className="text-zinc-500 mb-6 text-center max-w-md">
          This item was removed from the shop by an administrator or is no longer available.
        </p>
        <Link to="/shop" className="text-emerald-500 hover:underline">Return to Shop</Link>
      </div>
    );
  }

  const calculateSqMeter = () => {
    if (width && length) {
      return (parseFloat(width) * parseFloat(length)).toFixed(2);
    }
    return '0';
  };

  const calculatePrice = () => {
    if (!product.price) {
      return '0';
    }

    if (!product.requiresDimensions) {
      return Number(product.price).toFixed(2);
    }

    if (!width || !length) {
      return '0';
    }

    const w = parseFloat(width);
    const h = parseFloat(length);
    const area = w * h;
    const price = (area * product.price).toFixed(2);
    return price;
  };

  const productMaterials = Array.isArray(product.materials) && product.materials.length > 0
    ? product.materials
    : ['Material details unavailable'];
  const productVariants = Array.isArray(product.variants) && product.variants.length > 0
    ? product.variants
    : [];

  const handleAdd = () => {
    if (!session) {
      alert('Please sign in first to add this item to your cart.');
      navigate('/signin');
      return;
    }

    if (product.requiresDimensions && (!width || !length)) {
      alert('Please enter both width and length');
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      alert('Please enter a valid quantity.');
      return;
    }

    const sqMeter = calculateSqMeter();
    const calculatedPrice = parseFloat(calculatePrice());
    const variantSuffix = selectedVariant ? ` • ${selectedVariant}` : '';
    const selectedSize = product.requiresDimensions
      ? `${width}${product.dimensionUnit || 'm'} × ${length}${product.dimensionUnit || 'm'} (${sqMeter} ${product.pricingUnit || 'sq.m'})${variantSuffix}`
      : `Standard (${product.pricingUnit || 'each'})${variantSuffix}`;

    const success = addToCart({ 
      ...product, 
      price: calculatedPrice,
      orderQuantity: quantity,
      selectedSize,
      basePrice: product.price,
      area: product.requiresDimensions ? parseFloat(sqMeter) : 1,
    });

    if (!success) {
      alert('Please sign in first to add this item to your cart.');
      navigate('/signin');
      return;
    }

    if (success) {
      setAdded(true);
      setTimeout(() => setAdded(false), 2000);
    }
  };

  return (
    <div className="px-6 md:px-12 py-12">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm uppercase tracking-widest text-zinc-500 hover:text-zinc-50 mb-12 transition-colors"
      >
        <ArrowLeft size={16} /> Back
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-24 items-center">
        {/* Product Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="aspect-4/5 bg-zinc-900 rounded-sm overflow-hidden"
        >
          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
        </motion.div>

        {/* Product Info */}
        <motion.div 
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col justify-center"
        >
          <p className="text-emerald-500 text-sm font-bold tracking-widest uppercase mb-4">
            {product.category}
          </p>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase mb-6">
            {product.name}
          </h1>
          <div className="mb-12">
            <p className="text-sm text-zinc-400 mb-2">Price per {product.pricingUnit || 'unit'}</p>
            <p className="text-3xl font-light">₱{product.price}</p>
            {(product.requiresDimensions ? width && length : true) && (
              <p className="text-lg text-emerald-400 mt-3">
                Total: ₱{(parseFloat(calculatePrice()) * quantity).toFixed(2)}
              </p>
            )}
          </div>
          
          <div className="mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-3">Description</p>
            <p className="text-lg text-zinc-400 font-light leading-relaxed">
              {product.description}
            </p>
          </div>

          {productVariants.length > 0 && (
            <div className="mb-12">
              <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500 mb-3">Variants</p>
              <div className="flex flex-wrap gap-2">
                {productVariants.map((variant) => (
                  <button
                    key={variant}
                    type="button"
                    onClick={() => setSelectedVariant(variant)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-widest transition-colors ${
                      selectedVariant === variant
                        ? 'border-emerald-400 bg-emerald-400 text-zinc-950'
                        : 'border-white/15 bg-white/5 text-zinc-200 hover:border-emerald-300'
                    }`}
                  >
                    {variant}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mb-8 space-y-4">
            <p className="text-sm font-semibold uppercase tracking-widest text-zinc-500">Custom Size</p>
            {product.requiresDimensions ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-400">Width ({product.dimensionUnit || 'm'})</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      placeholder="e.g. 2"
                      className="quantity-input-no-spinner w-full rounded-2xl border border-zinc-800 bg-white/5 px-4 py-3 text-zinc-50 placeholder:text-zinc-600 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-xs font-medium text-zinc-400">Height ({product.dimensionUnit || 'm'})</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      placeholder="e.g. 3"
                      className="quantity-input-no-spinner w-full rounded-2xl border border-zinc-800 bg-white/5 px-4 py-3 text-zinc-50 placeholder:text-zinc-600 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                    />
                  </div>
                </div>
                {width && length && (
                  <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
                    <p className="text-xs text-zinc-400 mb-2">Area: {width} × {length} = {calculateSqMeter()} {product.pricingUnit || 'sq.m'}</p>
                    <p className="text-sm font-semibold text-emerald-300">
                      {width}{product.dimensionUnit || 'm'} × {length}{product.dimensionUnit || 'm'}
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3">
                <p className="text-sm font-semibold text-emerald-300">Fixed pricing item (no size input needed).</p>
              </div>
            )}
          </div>

          <div className="mb-8 space-y-2">
            <label className="block text-sm font-semibold uppercase tracking-widest text-zinc-500">Quantity Per Order</label>
            <input
              type="number"
              min="1"
              step="1"
              inputMode="numeric"
              value={quantity}
              onChange={(e) => {
                const parsed = Number.parseInt(e.target.value, 10);
                if (Number.isNaN(parsed)) {
                  setQuantity(1);
                  return;
                }
                setQuantity(Math.max(1, parsed));
              }}
              className="quantity-input-no-spinner w-full rounded-2xl border border-zinc-800 bg-white/5 px-4 py-3 text-zinc-50 placeholder:text-zinc-600 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
            />
          </div>

          <div className="space-y-6">
            <button 
              onClick={handleAdd}
              disabled={added}
              className={`w-full py-5 px-8 flex items-center justify-center gap-3 text-lg font-bold tracking-widest uppercase transition-all duration-300 ${
                added 
                  ? 'bg-zinc-800 text-emerald-400 cursor-default' 
                  : 'bg-zinc-50 text-zinc-950 hover:bg-emerald-400 hover:text-zinc-950'
              }`}
            >
              {added ? (
                <>
                  <Check size={24} />
                  Added to Cart
                </>
              ) : (
                'Add to Cart'
              )}
            </button>
            <Link 
              to="/cart"
              className="w-full py-5 px-8 flex items-center justify-center border border-zinc-800 hover:border-zinc-50 text-lg font-bold tracking-widest uppercase transition-colors"
            >
              Go to Cart
            </Link>
          </div>

          {/* Product specs */}
          <div className="mt-16 pt-12 border-t border-zinc-900 grid grid-cols-2 gap-8 text-sm uppercase tracking-widest text-zinc-500">
            <div>
              <p className="text-zinc-50 mb-2 font-bold">Materials</p>
              <p>
                {productMaterials.map((material, index) => (
                  <span key={`${material}-${index}`}>
                    {material}
                    <br />
                  </span>
                ))}
              </p>
            </div>
            <div>
              <p className="text-zinc-50 mb-2 font-bold">Dimensions</p>
              {width && length ? (
                <p>
                  W: {width}{product.dimensionUnit || 'm'}
                  <br />
                  H: {length}{product.dimensionUnit || 'm'}
                  <br />
                  AREA: {calculateSqMeter()} {product.pricingUnit || 'SQ.M'}
                </p>
              ) : (
                <p>{product.requiresDimensions ? 'Set width and height' : `Standard (${product.pricingUnit || 'each'})`}</p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};