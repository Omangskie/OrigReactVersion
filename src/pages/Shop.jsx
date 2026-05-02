import React, { useMemo, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useStore } from '../context/StoreContext';

export const Shop = () => {
  const { activeProducts } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('All');

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(activeProducts.map((product) => product.category).filter(Boolean))];
    return ['All', ...uniqueCategories.sort((a, b) => a.localeCompare(b))];
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === 'All') {
      return activeProducts;
    }
    return activeProducts.filter((product) => product.category === selectedCategory);
  }, [activeProducts, selectedCategory]);

  return (
    <div className="px-6 md:px-12 py-12">
      <header className="mb-20">
        <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase mb-6">
          The Collection
        </h1>
        <div className="flex gap-4 text-sm tracking-widest uppercase overflow-x-auto pb-4 hide-scrollbar">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full border transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-zinc-800 hover:border-emerald-500 hover:text-emerald-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </header>

      {activeProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-12 text-center text-zinc-400">
          The catalog is empty right now. Add items from the admin dashboard to repopulate the shop.
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/60 p-12 text-center text-zinc-400">
          No products found for {selectedCategory}.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
          {filteredProducts.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <Link to={`/product/${product.id}`} className="group block">
              <div className="aspect-3/4 overflow-hidden rounded-sm bg-zinc-900 mb-6 relative">
                <motion.img 
                  whileHover={{ scale: 1.05 }}
                  transition={{ duration: 0.6 }}
                  src={product.image} 
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-bold group-hover:text-emerald-400 transition-colors">{product.name}</h3>
                  <p className="text-sm text-zinc-500 mt-1 uppercase tracking-widest">{product.category}</p>
                </div>
                <p className="text-lg font-medium">₱{product.price}</p>
              </div>
            </Link>
          </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};