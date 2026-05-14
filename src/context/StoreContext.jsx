/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useState, useContext } from 'react';
import { PRODUCTS } from '../data/products';
import { useUserAuth } from '../auth/AuthContext';
import { app } from '../config/FirebaseConfig';
import { addDoc, collection, doc, getFirestore, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';

const StoreContext = createContext(undefined);

const CATALOG_STORAGE_KEY = 'theoriginals.catalog';
const CART_STORAGE_KEY = 'theoriginals.cart';

const getCartItemKey = (productId, size) => `${productId}::${size || 'default'}`;

const ORDER_STATUS_STEPS = ['Pending Payment Approval', 'Processing', 'Shipped', 'Delivered', 'Complete', 'Payment Rejected'];

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
  const [orders, setOrders] = useState([]);
  const [catalog, setCatalog] = useState(createInitialCatalog);
  const { userProfile, session, authReady, isConfiguredAdminEmail } = useUserAuth();
  const db = getFirestore(app);
  const auth = getAuth(app);
  const storage = getStorage(app);

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

    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  const activeProducts = catalog.filter((product) => !product.isArchived);
  const archivedProducts = catalog.filter((product) => product.isArchived);

  useEffect(() => {
    if (!authReady) {
      return undefined;
    }

    if (!session?.uid) {
      setOrders([]);
      return undefined;
    }

    const ordersCollection = collection(db, 'orders');
    const isAdmin =
      userProfile?.role === 'admin' ||
      (userProfile == null && session?.email && isConfiguredAdminEmail(session.email)) ||
      session?.displayName === 'admin';

    console.log('StoreContext - isAdmin check:', {
      userProfileRole: userProfile?.role,
      userProfileNull: userProfile == null,
      sessionEmail: session?.email,
      isConfiguredAdminEmail: session?.email ? isConfiguredAdminEmail(session.email) : false,
      sessionDisplayName: session?.displayName,
      isAdmin
    });

    const ordersQuery = isAdmin
      ? query(ordersCollection)
      : query(ordersCollection, where('purchaserUid', '==', session.uid));

    const unsubscribe = onSnapshot(
      ordersQuery,
      (snapshot) => {
        const nextOrders = snapshot.docs
          .map((entry) => ({ firestoreId: entry.id, ...entry.data() }))
          .sort((a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());
        setOrders(nextOrders);
      },
      (error) => {
        console.error('Unable to sync orders from Firestore:', error);
      }
    );

    return () => unsubscribe();
  }, [authReady, db, session?.uid, userProfile?.role, session?.email]);

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

  const createOrderId = () => `ORD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  const compressReceiptImage = async (file) => {
    if (typeof window === 'undefined') {
      return '';
    }

    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Unable to read the uploaded receipt.'));
      reader.readAsDataURL(file);
    });

    if (!dataUrl) {
      return '';
    }

    const image = await new Promise((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Unable to load the uploaded receipt image.'));
      element.src = dataUrl;
    });

    const maxWidth = 1400;
    const maxHeight = 1400;
    let { width, height } = image;
    const scale = Math.min(maxWidth / width, maxHeight / height, 1);
    width = Math.max(1, Math.round(width * scale));
    height = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    if (!context) {
      return dataUrl;
    }

    context.drawImage(image, 0, 0, width, height);
    return canvas.toDataURL('image/jpeg', 0.85);
  };

  const uploadPaymentProof = async ({ purchaserUid, orderId, fileName, proofImage }) => {
    if (!proofImage) {
      return '';
    }

    if (!proofImage.startsWith('data:image/')) {
      return proofImage;
    }

    const safeFileName = String(fileName || 'receipt-proof').replace(/[^a-zA-Z0-9._-]/g, '_');
    const receiptRef = ref(storage, `order-receipts/${purchaserUid}/${orderId}/${Date.now()}-${safeFileName}`);
    const proofBlob = await (await fetch(proofImage)).blob();

    await uploadBytes(receiptRef, proofBlob, {
      contentType: proofBlob.type || 'image/jpeg',
    });

    return getDownloadURL(receiptRef);
  };

  const placeOrder = async () => {
    if (cart.length === 0 || !session?.uid) {
      return '';
    }

    const now = new Date();
    const newOrder = {
      id: createOrderId(),
      items: [...cart],
      total: cartTotal,
      status: 'Processing',
      date: now.toISOString(),
      estimatedDelivery: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      purchaserRole: userProfile?.role || 'customer',
      purchaserEmail: userProfile?.email || '',
      purchaserUid: session.uid,
      payment: {
        status: 'approved',
      },
    };

    await addDoc(collection(db, 'orders'), newOrder);
    clearCart();

    return newOrder.id;
  };

  const submitOrderForPaymentReview = async ({
    shipping = {},
    contact = {},
    payment = {},
  } = {}) => {
    if (cart.length === 0 || !session?.uid) {
      return '';
    }
    const now = new Date();
    const orderId = createOrderId();
    const proofImageUrl = await uploadPaymentProof({
      purchaserUid: session.uid,
      orderId,
      fileName: payment.proofFileName,
      proofImage: payment.proofImage,
    });

    const newOrder = {
      id: orderId,
      items: [...cart],
      total: cartTotal,
      status: 'Pending Payment Approval',
      date: now.toISOString(),
      estimatedDelivery: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      purchaserRole: userProfile?.role || 'customer',
      purchaserEmail: userProfile?.email || contact.email || '',
      purchaserUid: session.uid,
      shipping: {
        firstName: contact.firstName || '',
        lastName: contact.lastName || '',
        email: contact.email || userProfile?.email || '',
        addressLine: shipping.addressLine || '',
        city: shipping.city || '',
        stateProvince: shipping.stateProvince || '',
        postalCode: shipping.postalCode || '',
      },
      payment: {
        provider: 'paymongo',
        method: 'qrph',
        status: 'pending_review',
        reference: payment.reference || '',
        paymentIntentId: payment.paymentIntentId || '',
        qrImageUrl: payment.qrImageUrl || '',
        proofImage: proofImageUrl,
        proofFileName: payment.proofFileName || '',
        submittedAt: now.toISOString(),
      },
    };

    await addDoc(collection(db, 'orders'), newOrder);
    clearCart();
    return orderId;
  };

  const approveOrderPayment = async (orderId) => {
    const order = orders.find((entry) => entry.id === orderId);
    if (!order?.firestoreId) {
      return false;
    }

    const reviewedAt = new Date().toISOString();
    const nextStatus = order.status === 'Pending Payment Approval' ? 'Processing' : order.status;

    try {
      await updateDoc(doc(db, 'orders', order.firestoreId), {
        status: nextStatus,
        payment: {
          ...(order.payment || {}),
          status: 'approved',
          reviewedAt,
        },
      });

      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus, payment: { ...(o.payment || {}), status: 'approved', reviewedAt } } : o))
      );

      return true;
    } catch (err) {
      console.error('approveOrderPayment failed:', err);
      return false;
    }
  };

  const rejectOrderPayment = async (orderId, reason = '') => {
    const order = orders.find((entry) => entry.id === orderId);
    if (!order?.firestoreId) {
      return false;
    }

    const reviewedAt = new Date().toISOString();

    try {
      await updateDoc(doc(db, 'orders', order.firestoreId), {
        status: 'Payment Rejected',
        payment: {
          ...(order.payment || {}),
          status: 'rejected',
          reviewedAt,
          rejectionReason: reason,
        },
      });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, status: 'Payment Rejected', payment: { ...(o.payment || {}), status: 'rejected', reviewedAt, rejectionReason: reason } }
            : o
        )
      );

      return true;
    } catch (err) {
      console.error('rejectOrderPayment failed:', err);
      return false;
    }
  };

  const cancelOrder = async (orderId) => {
    const order = orders.find((entry) => entry.id === orderId);
    if (!order?.firestoreId || !['Pending Payment Approval', 'Processing'].includes(order.status)) {
      return false;
    }

    try {
      await updateDoc(doc(db, 'orders', order.firestoreId), { status: 'Cancelled' });

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: 'Cancelled' } : o)));
      return true;
    } catch (err) {
      console.error('cancelOrder failed:', err);
      return false;
    }
  };

  const updateOrderStatus = async (orderId, nextStatus) => {
    if (!ORDER_STATUS_STEPS.includes(nextStatus)) {
      return false;
    }
    const order = orders.find((entry) => entry.id === orderId);
    if (!order?.firestoreId) {
      return false;
    }

    try {
      await updateDoc(doc(db, 'orders', order.firestoreId), { status: nextStatus });

      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: nextStatus } : o)));

      return true;
    } catch (err) {
      console.error('updateOrderStatus failed:', err);
      return false;
    }
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
        submitOrderForPaymentReview,
        approveOrderPayment,
        rejectOrderPayment,
        cancelOrder,
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
