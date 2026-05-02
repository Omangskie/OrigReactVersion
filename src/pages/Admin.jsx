import { useEffect, useMemo, useState } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import { ArchiveRestore, BarChart3, ShieldCheck, ShoppingBag, Users, UserRoundCog, Upload, DollarSign, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../auth/AuthContext';
import { useStore } from '../context/StoreContext';
import PricingForm from '../components/admin/PricingForm';

export default function Admin() {
  const { session, userProfile, users, signOut, suspendUser, deleteUser, restoreUser, setUserRole } = useUserAuth();
  const { activeProducts, archivedProducts, archiveProduct, restoreProduct, updateProduct, addProduct, orders } = useStore();
  const [busyUserId, setBusyUserId] = useState('');
  const [busyProductId, setBusyProductId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productForm, setProductForm] = useState({
    name: '',
    price: '',
    image: '',
    sizes: [],
    description: '',
  });
  const [productMessage, setProductMessage] = useState('');
  const [savingPricing, setSavingPricing] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newProductForm, setNewProductForm] = useState({
    name: '',
    price: '',
    image: '',
    sizes: '',
    description: '',
    category: '',
    unitType: 'fixed',
    pricePerUnit: '',
  });
  const [newProductMessage, setNewProductMessage] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    if (activeProducts.length === 0) {
      setSelectedProductId('');
      return;
    }

    if (!selectedProductId || !activeProducts.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(activeProducts[0].id);
    }
  }, [activeProducts, selectedProductId]);

  useEffect(() => {
    const product = activeProducts.find((entry) => entry.id === selectedProductId);

    if (!product) {
      return;
    }

    const sizes = Array.isArray(product.sizes)
      ? product.sizes.map((s) => ({
          width: typeof s === 'object' ? s.width || '' : '',
          length: typeof s === 'object' ? s.length || '' : '',
          sqrMeter: typeof s === 'object' ? s.sqrMeter || '' : '',
        }))
      : [];

    setProductForm({
      name: product.name || '',
      price: String(product.price ?? ''),
      image: product.image || '',
      sizes,
      description: product.description || '',
    });
  }, [activeProducts, selectedProductId]);

  const metrics = useMemo(() => {
    const activeUsers = users.filter((user) => user.status === 'active').length;
    const suspendedUsers = users.filter((user) => user.status === 'suspended').length;
    const deletedUsers = users.filter((user) => user.status === 'deleted').length;
    const collaborators = users.filter((user) => user.role === 'collaborator' && user.status === 'active').length;
    const soldItems = orders.reduce((sum, order) => sum + order.items.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
    const revenueFromNormalUsers = orders
      .filter((order) => order.purchaserRole !== 'admin')
      .reduce((sum, order) => sum + order.total, 0);
    const categoryTotals = activeProducts.reduce((accumulator, product) => {
      const next = { ...accumulator };
      next[product.category] = (next[product.category] || 0) + 1;
      return next;
    }, {});

    return {
      activeUsers,
      suspendedUsers,
      deletedUsers,
      collaborators,
      soldItems,
      revenueFromNormalUsers,
      categoryTotals,
    };
  }, [activeProducts, orders, users]);

  const handleProductAction = async (productId, action) => {
    setBusyProductId(productId);
    try {
      if (action === 'archive') {
        archiveProduct(productId);
      }

      if (action === 'restore') {
        restoreProduct(productId);
      }
    } finally {
      setBusyProductId('');
    }
  };

  const handleUserAction = async (userId, action) => {
    setBusyUserId(userId);
    try {
      if (action === 'suspend') {
        await suspendUser(userId);
      }

      if (action === 'delete') {
        await deleteUser(userId);
      }

      if (action === 'restore') {
        await restoreUser(userId);
      }

      if (action === 'collaborator') {
        await setUserRole(userId, 'collaborator');
      }

      if (action === 'customer') {
        await setUserRole(userId, 'customer');
      }
    } finally {
      setBusyUserId('');
    }
  };

  const handleProductUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const imagePath = `/productImage/${file.name}`;
    setProductForm((current) => ({ ...current, image: imagePath }));
    setProductMessage(`Image path set to ${imagePath}. Make sure the file exists in public/productImage.`);
    window.setTimeout(() => setProductMessage(''), 4000);
  };

  const handleSaveProduct = (event) => {
    event.preventDefault();

    if (!selectedProductId) {
      return;
    }

    updateProduct(selectedProductId, {
      ...productForm,
      price: Number(productForm.price) || 0,
      sizes: productForm.sizes.filter((s) => s.width && s.length && s.sqrMeter),
    });
    setProductMessage('Product updated successfully.');
    window.setTimeout(() => setProductMessage(''), 2500);
  };

  const handleSavePricing = async (pricingData) => {
    if (!selectedProductId) {
      return;
    }
    setSavingPricing(true);
    try {
      updateProduct(selectedProductId, pricingData);
      setProductMessage('Pricing updated successfully.');
      window.setTimeout(() => setProductMessage(''), 2500);
    } finally {
      setSavingPricing(false);
    }
  };

  const handleNewProductUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setNewProductForm((current) => ({ ...current, image: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleCreateProduct = (event) => {
    event.preventDefault();

    if (!newProductForm.name || !newProductForm.price || !newProductForm.category) {
      setNewProductMessage('Please fill in all required fields (Name, Price, Category)');
      window.setTimeout(() => setNewProductMessage(''), 3000);
      return;
    }

    const newProduct = {
      id: `p-${Date.now()}`,
      name: newProductForm.name,
      price: Number(newProductForm.price) || 0,
      image: newProductForm.image,
      sizes: newProductForm.sizes
        ? newProductForm.sizes
            .split(',')
            .map((size) => size.trim())
            .filter(Boolean)
        : [],
      description: newProductForm.description,
      category: newProductForm.category,
      unitType: newProductForm.unitType || 'fixed',
      pricePerUnit: newProductForm.pricePerUnit ? Number(newProductForm.pricePerUnit) : Number(newProductForm.price),
      dimensions: {
        width: null,
        height: null,
        length: null,
      },
      isArchived: false,
    };

    addProduct(newProduct);
    
    setNewProductForm({
      name: '',
      price: '',
      image: '',
      sizes: '',
      description: '',
      category: '',
      unitType: 'fixed',
      pricePerUnit: '',
    });
    setShowCreateForm(false);
    setNewProductMessage('Product created successfully!');
    window.setTimeout(() => setNewProductMessage(''), 2500);
  };

  if (!session) {
    return null;
  }

  return (
    <div
      className="min-h-screen text-zinc-50"
      style={{
        backgroundImage:
          'radial-gradient(circle_at_top,rgba(16,185,129,0.18),transparent_35%),linear-gradient(180deg,#020617_0%,#020617_100%)',
      }}
    >
      <div className="border-b border-white/10 backdrop-blur-xl bg-slate-950/70 sticky top-0 z-20">
        <div className="mx-auto max-w-7xl px-6 md:px-10 py-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Admin Control Center</p>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight uppercase">Operations dashboard</h1>
            <p className="mt-2 text-sm text-zinc-400">Signed in as {userProfile?.email || session.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link to="/shop" className="rounded-full border border-white/10 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-zinc-300 hover:border-emerald-400 hover:text-emerald-300 transition-colors">
              View shop
            </Link>
            <button onClick={() => signOut()} className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold uppercase tracking-widest text-slate-950 hover:bg-emerald-300 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-6 md:px-10 py-10">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
            <div className="space-y-4 mb-8">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Admin sections</p>
              <h2 className="text-2xl font-black uppercase tracking-tight">Manage everything</h2>
              <p className="text-sm text-zinc-400">Select the area you want to work with, then use the panel to the right.</p>
            </div>

            <div className="space-y-3">
              {[
                { value: 'dashboard', label: 'Dashboard' },
                { value: 'products', label: 'Products' },
                { value: 'users', label: 'Users' },
                { value: 'sales', label: 'Sales' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setActiveTab(tab.value)}
                  className={`w-full rounded-3xl border px-4 py-4 text-left text-sm font-semibold uppercase tracking-[0.25em] transition ${
                    activeTab === tab.value
                      ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-zinc-200 hover:border-emerald-400 hover:bg-emerald-400/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </aside>

          <div className="space-y-10">
            {activeTab === 'dashboard' && (
              <>
                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: 'Active users', value: metrics.activeUsers, icon: Users },
                    { label: 'Items sold', value: metrics.soldItems, icon: ShoppingBag },
                    { label: 'Active products', value: activeProducts.length, icon: UserRoundCog },
                    { label: 'Normal user revenue', value: `₱${metrics.revenueFromNormalUsers.toFixed(2)}`, icon: BarChart3 },
                  ].map((item) => {
                    const Icon = item.icon;

                    return (
                      <div key={item.label} className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-zinc-400">{item.label}</p>
                            <p className="mt-3 text-3xl font-black tracking-tight">{item.value}</p>
                          </div>
                          <div className="rounded-2xl bg-emerald-400/10 p-3 text-emerald-300">
                            <Icon size={22} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Active users</span>
                        <span className="font-semibold text-zinc-100">{metrics.activeUsers}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Suspended users</span>
                        <span className="font-semibold text-zinc-100">{metrics.suspendedUsers}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Deleted users</span>
                        <span className="font-semibold text-zinc-100">{metrics.deletedUsers}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Order total</span>
                        <span className="font-semibold text-zinc-100">{orders.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-zinc-400">Normal user revenue</span>
                        <span className="font-semibold text-zinc-100">₱{metrics.revenueFromNormalUsers.toFixed(2)}</span>
                      </div>
                    </div>

                    <div className="mt-8 space-y-4">
                      {Object.entries(metrics.categoryTotals).map(([category, count]) => {
                        const maxCount = Math.max(...Object.values(metrics.categoryTotals), 1);
                        return (
                          <div key={category}>
                            <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-zinc-500 mb-2">
                              <span>{category}</span>
                              <span>{count}</span>
                            </div>
                            <div className="h-2 rounded-full bg-white/5">
                              <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${(count / maxCount) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}

                      {Object.keys(metrics.categoryTotals).length === 0 && (
                        <div className="rounded-2xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">
                          No active products to analyze yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
                    <div className="flex items-center gap-3 mb-6">
                      <BarChart3 size={20} className="text-emerald-300" />
                      <h2 className="text-2xl font-black uppercase tracking-tight">Recent sales</h2>
                    </div>

                    <div className="space-y-3 max-h-96 overflow-auto pr-1">
                      {orders.length === 0 ? (
                        <div className="rounded-3xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">
                          No purchases recorded yet.
                        </div>
                      ) : (
                        orders.map((order) => {
                          const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

                          return (
                            <div key={order.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm">
                              <div className="flex items-start justify-between gap-4">
                                <div>
                                  <p className="font-semibold text-zinc-100">{order.purchaserEmail || 'Unknown buyer'}</p>
                                  <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                                    {order.purchaserRole || 'customer'} · {new Date(order.date).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-emerald-300">₱{order.total.toFixed(2)}</p>
                                  <p className="text-xs text-zinc-500">{itemCount} items sold</p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}

            {activeTab === 'products' && (
              <div className="space-y-6">
                <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
                  <div className="flex items-center justify-between gap-4 mb-6">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Catalog control</p>
                      <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Shop inventory</h2>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-zinc-400">
                      <ArchiveRestore size={16} />
                      {archivedProducts.length} archived
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {[...activeProducts.map((product) => ({ ...product, variant: 'active' })), ...archivedProducts.map((product) => ({ ...product, variant: 'archived' }))].map((product) => (
                      <motion.article
                        key={product.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="overflow-hidden rounded-3xl border border-white/10 bg-white/5"
                      >
                        <div className="aspect-4/3 overflow-hidden relative">
                          <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-linear-to-t from-slate-950 via-transparent to-transparent" />
                          <span className={`absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest ${product.variant === 'active' ? 'bg-emerald-400 text-slate-950' : 'bg-amber-400 text-slate-950'}`}>
                            {product.variant === 'active' ? 'Live' : 'Archived'}
                          </span>
                        </div>
                        <div className="p-5 space-y-4">
                          <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">{product.category}</p>
                            <h3 className="mt-2 text-xl font-bold">{product.name}</h3>
                            <p className="mt-2 text-sm text-zinc-400 line-clamp-2">{product.description}</p>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-lg font-semibold text-emerald-300">₱{product.price}</p>
                            <button
                              onClick={() => handleProductAction(product.id, product.variant === 'active' ? 'archive' : 'restore')}
                              disabled={busyProductId === product.id}
                              className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-zinc-200 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-60"
                            >
                              {product.variant === 'active' ? 'Remove from shop' : 'Restore'}
                            </button>
                          </div>
                        </div>
                      </motion.article>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Product creation</p>
                        <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Add new product</h2>
                      </div>
                      <Plus size={20} className="text-emerald-300" />
                    </div>

                    {!showCreateForm ? (
                      <button
                        onClick={() => setShowCreateForm(true)}
                        className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold uppercase tracking-[0.25em] text-slate-950 hover:bg-emerald-300"
                      >
                        + Create New Product
                      </button>
                    ) : (
                      <form onSubmit={handleCreateProduct} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm text-zinc-300">
                            <span>Product name *</span>
                            <input
                              type="text"
                              value={newProductForm.name}
                              onChange={(event) => setNewProductForm((current) => ({ ...current, name: event.target.value }))}
                              placeholder="e.g., Premium Tarpaulin"
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                              required
                            />
                          </label>

                          <label className="space-y-2 text-sm text-zinc-300">
                            <span>Category *</span>
                            <input
                              type="text"
                              value={newProductForm.category}
                              onChange={(event) => setNewProductForm((current) => ({ ...current, category: event.target.value }))}
                              placeholder="e.g., Tarpaulin, DTF, Sticker"
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                              required
                            />
                          </label>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm text-zinc-300">
                            <span>Base Price (₱) *</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newProductForm.price}
                              onChange={(event) => setNewProductForm((current) => ({ ...current, price: event.target.value }))}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                              required
                            />
                          </label>

                          <label className="space-y-2 text-sm text-zinc-300">
                            <span>Pricing Unit Type</span>
                            <select
                              value={newProductForm.unitType}
                              onChange={(event) => setNewProductForm((current) => ({ ...current, unitType: event.target.value }))}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            >
                              <option value="fixed">Fixed Price</option>
                              <option value="sq_ft">Square Feet</option>
                              <option value="linear_meter">Linear Meters</option>
                              <option value="sq_inch">Square Inches</option>
                            </select>
                          </label>
                        </div>

                        {newProductForm.unitType !== 'fixed' && (
                          <label className="space-y-2 text-sm text-zinc-300">
                            <span>Price per {newProductForm.unitType === 'linear_meter' ? 'meter' : 'unit'} (₱)</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={newProductForm.pricePerUnit}
                              onChange={(event) => setNewProductForm((current) => ({ ...current, pricePerUnit: event.target.value }))}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            />
                          </label>
                        )}

                        <label className="space-y-2 text-sm text-zinc-300 block">
                          <span>Image URL or upload</span>
                          <input
                            type="url"
                            value={newProductForm.image}
                            onChange={(event) => setNewProductForm((current) => ({ ...current, image: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            placeholder="https://..."
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleNewProductUpload}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                          />
                        </label>

                        <label className="space-y-2 text-sm text-zinc-300 block">
                          <span>Sizes</span>
                          <input
                            type="text"
                            value={newProductForm.sizes}
                            onChange={(event) => setNewProductForm((current) => ({ ...current, sizes: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            placeholder="S, M, L, XL"
                          />
                          <p className="text-xs text-zinc-500">Separate sizes with commas. Leave empty if not applicable.</p>
                        </label>

                        <label className="space-y-2 text-sm text-zinc-300 block">
                          <span>Description</span>
                          <textarea
                            rows="4"
                            value={newProductForm.description}
                            onChange={(event) => setNewProductForm((current) => ({ ...current, description: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            placeholder="Describe the product..."
                          />
                        </label>

                        <div className="flex gap-3">
                          <button
                            type="submit"
                            className="flex-1 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold uppercase tracking-[0.25em] text-slate-950 hover:bg-emerald-300"
                          >
                            Create Product
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateForm(false);
                              setNewProductForm({
                                name: '',
                                price: '',
                                image: '',
                                sizes: '',
                                description: '',
                                category: '',
                                unitType: 'fixed',
                                pricePerUnit: '',
                              });
                            }}
                            className="flex-1 rounded-2xl border border-white/10 px-5 py-3 text-sm font-bold uppercase tracking-[0.25em] text-zinc-300 hover:border-emerald-400 hover:text-emerald-300"
                          >
                            Cancel
                          </button>
                        </div>

                        {newProductMessage && (
                          <p className={`text-sm ${newProductMessage.includes('created') ? 'text-emerald-300' : 'text-red-300'}`}>
                            {newProductMessage}
                          </p>
                        )}
                      </form>
                    )}
                  </div>

                  <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
                    <div className="flex items-center justify-between gap-4 mb-6">
                      <div>
                        <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Product editor</p>
                        <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Edit image, price, sizes</h2>
                      </div>
                      <Upload size={20} className="text-emerald-300" />
                    </div>

                    {activeProducts.length === 0 ? (
                      <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
                        No active products available to edit.
                      </div>
                    ) : (
                      <form onSubmit={handleSaveProduct} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="space-y-2 text-sm text-zinc-300">
                            <span>Choose product</span>
                            <select
                              value={selectedProductId}
                              onChange={(event) => setSelectedProductId(event.target.value)}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            >
                              {activeProducts.map((product) => (
                                <option key={product.id} value={product.id} className="bg-slate-950 text-zinc-50">
                                  {product.name}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="space-y-2 text-sm text-zinc-300">
                            <span>Price</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={productForm.price}
                              onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))}
                              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            />
                          </label>
                        </div>

                        <label className="space-y-2 text-sm text-zinc-300 block">
                          <span>Image URL or upload</span>
                          <input
                            type="url"
                            value={productForm.image}
                            onChange={(event) => setProductForm((current) => ({ ...current, image: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            placeholder="https://..."
                          />
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProductUpload}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-400 file:mr-4 file:rounded-full file:border-0 file:bg-emerald-400 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                          />
                        </label>

                        <label className="space-y-2 text-sm text-zinc-300 block">
                          <span>Sizes</span>
                          <input
                            type="text"
                            value={productForm.sizes}
                            onChange={(event) => setProductForm((current) => ({ ...current, sizes: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                            placeholder="S, M, L"
                          />
                          <p className="text-xs text-zinc-500">Separate sizes with commas.</p>
                        </label>

                        <label className="space-y-2 text-sm text-zinc-300 block">
                          <span>Description</span>
                          <textarea
                            rows="4"
                            value={productForm.description}
                            onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                            className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-50 outline-none focus:border-emerald-400"
                          />
                        </label>

                        <button
                          type="submit"
                          className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold uppercase tracking-[0.25em] text-slate-950 hover:bg-emerald-300"
                        >
                          Save Product
                        </button>

                        {productMessage && <p className="text-sm text-emerald-300">{productMessage}</p>}
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'users' && (
              <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">User control</p>
                    <h2 className="mt-2 text-2xl font-black uppercase tracking-tight">Account moderation</h2>
                  </div>
                  <ShieldCheck size={20} className="text-emerald-300" />
                </div>

                <div className="space-y-4 max-h-136 overflow-auto pr-1">
                  {users.map((user) => (
                    <div key={user.uid} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-zinc-100">{user.email || 'Unknown user'}</p>
                          <p className="mt-1 text-xs uppercase tracking-[0.35em] text-zinc-500">
                            {user.role} · {user.status}
                          </p>
                        </div>
                        {user.uid === session.uid && (
                          <span className="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.35em] text-emerald-300">
                            You
                          </span>
                        )}
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          onClick={() => handleUserAction(user.uid, user.role === 'collaborator' ? 'customer' : 'collaborator')}
                          disabled={busyUserId === user.uid || user.uid === session.uid}
                          className="rounded-full border border-white/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-200 hover:border-emerald-400 hover:text-emerald-300 disabled:opacity-50"
                        >
                          {user.role === 'collaborator' ? 'Demote' : 'Make collaborator'}
                        </button>
                        {user.status === 'active' ? (
                          <>
                            <button
                              onClick={() => handleUserAction(user.uid, 'suspend')}
                              disabled={busyUserId === user.uid || user.uid === session.uid}
                              className="rounded-full border border-amber-400/30 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.3em] text-amber-200 hover:border-amber-300 disabled:opacity-50"
                            >
                              Suspend
                            </button>
                            <button
                              onClick={() => handleUserAction(user.uid, 'delete')}
                              disabled={busyUserId === user.uid || user.uid === session.uid}
                              className="rounded-full border border-rose-400/30 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.3em] text-rose-200 hover:border-rose-300 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleUserAction(user.uid, 'restore')}
                            disabled={busyUserId === user.uid || user.uid === session.uid}
                            className="rounded-full border border-emerald-400/30 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-300 disabled:opacity-50"
                          >
                            Retrieve
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {users.length === 0 && (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-zinc-500">
                      No user records are available yet.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'sales' && (
              <div className="rounded-4xl border border-white/10 bg-slate-950/80 p-6 md:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <BarChart3 size={20} className="text-emerald-300" />
                  <h2 className="text-2xl font-black uppercase tracking-tight">Recent sales</h2>
                </div>

                <div className="space-y-3 max-h-96 overflow-auto pr-1">
                  {orders.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-white/10 p-5 text-sm text-zinc-500">
                      No purchases recorded yet.
                    </div>
                  ) : (
                    orders.map((order) => {
                      const itemCount = order.items.reduce((sum, item) => sum + item.quantity, 0);

                      return (
                        <div key={order.id} className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-zinc-100">{order.purchaserEmail || 'Unknown buyer'}</p>
                              <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">
                                {order.purchaserRole || 'customer'} · {new Date(order.date).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-emerald-300">₱{order.total.toFixed(2)}</p>
                              <p className="text-xs text-zinc-500">{itemCount} items sold</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}