/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, useContext } from 'react';
import { PRODUCTS } from '../data/products';
import { useUserAuth } from '../auth/AuthContext';

const StoreContext = createContext(undefined);

const CATALOG_STORAGE_KEY = 'theoriginals.catalog';
const ORDERS_STORAGE_KEY = 'theoriginals.orders';
const CART_STORAGE_KEY = 'theoriginals.cart';

const getCartItemKey = (productId, size) => `${productId}::${size || 'default'}`;

const ORDER_STATUS_STEPS = ['Processing', 'Shipped', 'Delivered', 'Complete'];

const createInitialCatalog = () => {
  if (typeof window === 'undefined') {
    return PRODUCTS.map((product) => ({ ...product, isArchived: false }));
  }

  try {
    const storedCatalog = window.localStorage.getItem(CATALOG_STORAGE_KEY);

    if (!storedCatalog) {
      return PRODUCTS.map((product) => ({ ...product, isArchived: false }));
    }

    const parsedCatalog = JSON.parse(storedCatalog);

    if (!Array.isArray(parsedCatalog)) {
      window.localStorage.removeItem(CATALOG_STORAGE_KEY);
      return PRODUCTS.map((product) => ({ ...product, isArchived: false }));
    }

    if (PRODUCTS.length === 0) {
      window.localStorage.removeItem(CATALOG_STORAGE_KEY);
      return [];
    }

    const storedById = new Map(parsedCatalog.filter((product) => product?.id).map((product) => [product.id, product]));
    const mergedCatalog = PRODUCTS.map((product) => {
      const storedProduct = storedById.get(product.id);

      if (!storedProduct) {
        return { ...product, isArchived: false };
      }

      const isAdminEdited = storedProduct.editedByAdmin === true;

      return {
        ...product,
        ...(isAdminEdited
          ? {
              name: storedProduct.name ?? product.name,
              category: storedProduct.category ?? product.category,
              image: storedProduct.image ?? product.image,
              materials: storedProduct.materials ?? product.materials,
              description: storedProduct.description ?? product.description,
              requiresDimensions: storedProduct.requiresDimensions ?? product.requiresDimensions,
            }
          : {}),
        id: product.id,
        // Seeded products always follow products.jsx pricing chart values.
        price: product.price,
        pricingUnit: product.pricingUnit,
        dimensionUnit: product.dimensionUnit,
        requiresDimensions: product.requiresDimensions,
        isArchived: Boolean(storedProduct.isArchived),
        editedByAdmin: isAdminEdited,
      };
    });

    // Keep only extras that were intentionally created from admin tools.
    const adminCreatedExtras = parsedCatalog.filter(
      (product) =>
        product?.id &&
        !PRODUCTS.some((baseProduct) => baseProduct.id === product.id) &&
        product.createdByAdmin === true
    );

    return [...mergedCatalog, ...adminCreatedExtras.map((product) => ({ ...product, isArchived: Boolean(product.isArchived) }))];
  } catch (error) {
    console.error('Unable to load catalog state:', error);
    return PRODUCTS.map((product) => ({ ...product, isArchived: false }));
  }
};

const createInitialOrders = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedOrders = window.localStorage.getItem(ORDERS_STORAGE_KEY);
    const parsedOrders = storedOrders ? JSON.parse(storedOrders) : [];
    return Array.isArray(parsedOrders) ? parsedOrders : [];
  } catch (error) {
    console.error('Unable to load order history:', error);
    return [];
  }
};

const createInitialCart = () => {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const storedCart = window.localStorage.getItem(CART_STORAGE_KEY);
    const parsedCart = storedCart ? JSON.parse(storedCart) : [];
    return Array.isArray(parsedCart) ? parsedCart : [];
  } catch (error) {
    console.error('Unable to load cart state:', error);
    return [];
  }
};

export const StoreProvider = ({ children }) => {
  const [cart, setCart] = useState(createInitialCart);
  const [orders, setOrders] = useState(createInitialOrders);
  const [catalog, setCatalog] = useState(createInitialCatalog);
  const { userProfile, session, authReady } = useUserAuth();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
  }, [catalog]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify(orders));
  }, [orders]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const activeProducts = catalog.filter((product) => !product.isArchived);
  const archivedProducts = catalog.filter((product) => product.isArchived);

  const addToCart = (product) => {
    if (authReady && !session) {
      return false;
    }

    const incomingQuantity = Number.isFinite(product.orderQuantity)
      ? Math.max(1, Math.floor(product.orderQuantity))
      : 1;

    setCart((prev) => {
      const existing = prev.find((item) => getCartItemKey(item.product.id, item.size) === getCartItemKey(product.id, product.selectedSize));
      if (existing) {
        return prev.map((item) =>
          getCartItemKey(item.product.id, item.size) === getCartItemKey(product.id, product.selectedSize)
            ? { ...item, quantity: item.quantity + incomingQuantity }
            : item
        );
      }
      return [...prev, { product, quantity: incomingQuantity, size: product.selectedSize || product.size || product.variantSize || '', itemPrice: product.itemPrice || product.price }];
    });
    return true;
  };

  const removeFromCart = (productId, size) => {
    setCart((prev) => prev.filter((item) => getCartItemKey(item.product.id, item.size) !== getCartItemKey(productId, size)));
  };

  const updateQuantity = (productId, quantity, size) => {
    if (quantity <= 0) {
      removeFromCart(productId, size);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        getCartItemKey(item.product.id, item.size) === getCartItemKey(productId, size)
          ? { ...item, quantity }
          : item
      )
    );
  };

  const clearCart = () => setCart([]);

  const updateCartItemLayout = (productId, size, layoutImage) => {
    setCart((prev) =>
      prev.map((item) =>
        getCartItemKey(item.product.id, item.size) === getCartItemKey(productId, size)
          ? { ...item, layoutImage }
          : item
      )
    );
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.itemPrice || item.product.price) * item.quantity, 0);
  const catalogTotalValue = activeProducts.reduce((sum, product) => sum + product.price, 0);

  const getProductById = (productId) =>
    catalog.find((product) => product.id === productId && !product.isArchived);

  const archiveProduct = (productId) => {
    setCatalog((previousCatalog) =>
      previousCatalog.map((product) =>
        product.id === productId ? { ...product, isArchived: true, archivedAt: new Date().toISOString() } : product
      )
    );
  };

  const updateProduct = (productId, updates) => {
    setCatalog((previousCatalog) =>
      previousCatalog.map((product) =>
        product.id === productId
          ? {
              ...product,
              ...updates,
              price: typeof updates.price === 'string' ? Number(updates.price) : updates.price ?? product.price,
              sizes: Array.isArray(updates.sizes)
                ? updates.sizes
                : typeof updates.sizes === 'string'
                  ? updates.sizes.split(',').map((size) => size.trim()).filter(Boolean)
                  : product.sizes,
              editedByAdmin: true,
            }
          : product
      )
    );
  };

  const addProduct = (product) => {
    setCatalog((previousCatalog) => [
      ...previousCatalog,
      {
        ...product,
        id: product.id || `p-${Date.now()}`,
        createdByAdmin: true,
        isArchived: Boolean(product.isArchived),
        sizes: Array.isArray(product.sizes) ? product.sizes : [],
      },
    ]);
  };

  const restoreProduct = (productId) => {
    setCatalog((previousCatalog) =>
      previousCatalog.map((product) =>
        product.id === productId ? { ...product, isArchived: false, archivedAt: undefined } : product
      )
    );
  };

  const placeOrder = () => {
    if (cart.length === 0) return '';
    
    const newOrder = {
      id: `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      items: [...cart],
      total: cartTotal,
      status: 'Processing',
      date: new Date().toISOString(),
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      purchaserRole: userProfile?.role || 'customer',
      purchaserEmail: userProfile?.email || '',
    };
    
    setOrders((prev) => [newOrder, ...prev]);
    clearCart();

    return newOrder.id;
  };

  const updateOrderStatus = (orderId, nextStatus) => {
    if (!ORDER_STATUS_STEPS.includes(nextStatus)) {
      return;
    }

    setOrders((prev) =>
      prev.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
    );
  };

  return (
    <StoreContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQuantity,
        updateCartItemLayout,
        clearCart,
        cartTotal,
        authReady,
        catalog,
        activeProducts,
        archivedProducts,
        catalogTotalValue,
        getProductById,
        archiveProduct,
        restoreProduct,
        updateProduct,
        addProduct,
        getCartItemKey,
        orders,
        placeOrder,
        updateOrderStatus,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
