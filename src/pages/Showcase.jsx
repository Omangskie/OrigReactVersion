import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { app } from '../config/FirebaseConfig';

export const SHOWCASE_CATEGORIES = [
  'Tarpaulin',
  'Sticker',
  'Sticker on Sintra',
  'Direct to film(DTF)',
  'Tshirt with print',
  'Totebag with print',
  'Hoodie with print',
  'Calling cards',
];

export const Showcase = () => {
  const [showcaseItems, setShowcaseItems] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(SHOWCASE_CATEGORIES[0]);
  const [loading, setLoading] = useState(true);
  const db = getFirestore(app);

  useEffect(() => {
    const showcaseCollection = collection(db, 'showcase');
    const showcaseQuery = query(showcaseCollection, where('category', '==', selectedCategory));

    const unsubscribe = onSnapshot(
      showcaseQuery,
      (snapshot) => {
        const items = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setShowcaseItems(items);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading showcase items:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [selectedCategory, db]);

  return (
    <div className="px-6 md:px-12 py-12 max-w-7xl mx-auto">
      <div className="mb-16">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase mb-4">
          Showcase
        </h1>
        <p className="text-zinc-400 text-lg">Explore our previous works and projects across various product categories.</p>
      </div>

      {/* Category Filter */}
      <div className="mb-12">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-500 mb-4">Filter by category</p>
        <div className="flex flex-wrap gap-3">
          {SHOWCASE_CATEGORIES.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-widest transition-colors ${
                selectedCategory === category
                  ? 'bg-emerald-400 text-slate-950'
                  : 'border border-white/10 text-zinc-300 hover:border-emerald-400 hover:text-emerald-300'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Gallery Grid */}
      <div>
        {loading ? (
          <div className="text-center py-16 text-zinc-500">Loading showcase items...</div>
        ) : showcaseItems.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-zinc-500">
            <p>No showcase items available for {selectedCategory} yet.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {showcaseItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="group overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:border-emerald-400 transition-all"
              >
                <div className="aspect-square overflow-hidden bg-zinc-900 relative">
                  <img
                    src={item.imageUrl}
                    alt={item.title || item.category}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-400 mb-1">{item.category}</p>
                    {item.title && <h3 className="text-lg font-semibold text-zinc-50">{item.title}</h3>}
                  </div>
                  {item.description && (
                    <p className="text-sm text-zinc-400 line-clamp-2">{item.description}</p>
                  )}
                  {item.productName && (
                    <p className="text-xs text-zinc-500">Product: {item.productName}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Back to shop */}
      <div className="mt-16 text-center">
        <Link
          to="/shop"
          className="inline-block py-4 px-8 border border-zinc-800 text-zinc-50 font-bold tracking-widest uppercase hover:border-emerald-500 hover:text-emerald-400 transition-colors"
        >
          Back to Shop
        </Link>
      </div>
    </div>
  );
};
