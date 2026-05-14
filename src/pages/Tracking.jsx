import { useState } from 'react';
import { motion } from 'motion/react';
import { Link } from 'react-router';
import { useStore } from '../context/StoreContext';
import { Package, Truck, CheckCircle, Clock, XCircle } from 'lucide-react';

const STATUS_STEPS = ['Pending Payment Approval', 'Processing', 'Shipped', 'Delivered', 'Complete'];
const CANCELLABLE_STATUSES = ['Pending Payment Approval', 'Processing'];

export const Tracking = () => {
  const { orders, cancelOrder } = useStore();
  const [busyOrderId, setBusyOrderId] = useState('');
  const [orderMessage, setOrderMessage] = useState('');

  const canCancel = (order) => CANCELLABLE_STATUSES.includes(order.status);

  const handleCancelOrder = async (order) => {
    if (!canCancel(order)) {
      return;
    }

    const confirmed = window.confirm('Cancel this order? This will stop further processing.');
    if (!confirmed) {
      return;
    }

    setBusyOrderId(order.id);
    setOrderMessage('');

    try {
      const ok = await cancelOrder(order.id);
      if (!ok) {
        setOrderMessage('Unable to cancel the order. Please try again.');
      } else {
        setOrderMessage(`Order ${order.id} has been cancelled.`);
      }
    } finally {
      setBusyOrderId('');
    }
  };

  if (orders.length === 0) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mb-6 text-zinc-800">No Orders Yet</h1>
        <p className="text-zinc-500 mb-12">You haven't placed any orders with us.</p>
        <Link 
          to="/shop" 
          className="py-4 px-8 border border-zinc-800 text-zinc-50 font-bold tracking-widest uppercase hover:border-emerald-500 hover:text-emerald-400 transition-colors"
        >
          Start Shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-12 py-12 max-w-5xl mx-auto">
      <h1 className="text-5xl md:text-7xl font-bold tracking-tighter uppercase mb-16">
        Tracking
      </h1>

      {orderMessage && (
        <div className="mb-8 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 px-6 py-4 text-sm text-emerald-100">
          {orderMessage}
        </div>
      )}

      <div className="space-y-12">
        {orders.map((order, idx) => (
          <motion.div 
            key={order.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="border border-zinc-900 bg-zinc-950/50 p-8 rounded-sm relative overflow-hidden"
          >
            {/* Animated background glow for active order */}
            {order.status !== 'Delivered' && order.status !== 'Complete' && (
              <motion.div 
                className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              />
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-6 border-b border-zinc-900 pb-8 relative z-10">
              <div>
                <p className="text-sm font-bold uppercase tracking-widest text-emerald-500 mb-2">Order {order.id}</p>
                <p className="text-zinc-500 text-sm">{new Date(order.date).toLocaleDateString()} • {order.items.length} items</p>
              </div>
              <div className="text-left md:text-right">
                <p className="text-sm font-bold uppercase tracking-widest text-zinc-50 mb-2">Estimated Delivery</p>
                <p className="text-xl font-light">{new Date(order.estimatedDelivery).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="relative z-10 grid gap-6 xl:grid-cols-[1.35fr_0.85fr] mb-10">
              <div className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
                <div className="flex items-center justify-between gap-4 mb-6">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Order details</p>
                    <p className="text-lg font-semibold text-zinc-50 mt-3">{order.purchaserEmail || 'No contact email'}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.35em] ${order.status === 'Cancelled' ? 'bg-rose-400/20 text-rose-200' : order.status === 'Payment Rejected' ? 'bg-amber-400/20 text-amber-200' : order.status === 'Complete' || order.status === 'Delivered' ? 'bg-emerald-400/20 text-emerald-200' : 'bg-emerald-500/10 text-emerald-300'}`}>
                    {order.status === 'Cancelled' ? 'Order cancelled' : order.status}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Payment</p>
                    <p className="text-sm text-zinc-100">{order.payment?.status || 'N/A'}</p>
                    <p className="text-xs text-zinc-500">Method: {order.payment?.method || 'N/A'}</p>
                    {order.payment?.reference && <p className="text-xs text-zinc-500">Ref: {order.payment.reference}</p>}
                  </div>
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-[0.35em] text-zinc-500">Total</p>
                    <p className="text-2xl font-semibold text-emerald-300">₱{Number(order.total || 0).toFixed(2)}</p>
                    <p className="text-xs text-zinc-500">Items: {order.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
                <p className="text-xs uppercase tracking-[0.35em] text-emerald-400 mb-4">Shipping</p>
                <div className="space-y-2 text-sm text-zinc-100 mb-4">
                  <p>{order.shipping?.firstName} {order.shipping?.lastName}</p>
                  <p>{order.shipping?.email || order.purchaserEmail}</p>
                  <p>{order.shipping?.addressLine}</p>
                  <p>{order.shipping?.city}, {order.shipping?.stateProvince} {order.shipping?.postalCode}</p>
                </div>

                {canCancel(order) && (
                  <button
                    type="button"
                    onClick={() => handleCancelOrder(order)}
                    disabled={busyOrderId === order.id}
                    className="w-full rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm font-bold uppercase tracking-[0.25em] text-rose-200 hover:border-rose-300 hover:text-white disabled:opacity-60"
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <XCircle size={16} />
                      {busyOrderId === order.id ? 'Cancelling...' : 'Cancel Order'}
                    </span>
                  </button>
                )}

                {order.status === 'Cancelled' && (
                  <p className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                    This order has been cancelled.
                  </p>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="relative z-10 mb-12 py-6">
              <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-900 -translate-y-1/2" />
              
              {/* Progress Line */}
              <motion.div 
                className="absolute top-1/2 left-0 h-0.5 bg-emerald-500 -translate-y-1/2"
                initial={{ width: '0%' }}
                animate={{
                  width: `${Math.max(0, (STATUS_STEPS.indexOf(order.status) / (STATUS_STEPS.length - 1)) * 100)}%`,
                }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />

              <div className="relative flex justify-between">
                {STATUS_STEPS.map((step, index) => {
                  const statusIndex = STATUS_STEPS.indexOf(order.status);
                  const isActive = statusIndex >= index;
                  const isCurrent = order.status === step;
                  
                  return (
                    <div key={step} className="flex flex-col items-center gap-4 group">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ${
                        isActive ? 'bg-emerald-500 text-zinc-950' : 'bg-zinc-900 text-zinc-600 border border-zinc-800'
                      }`}>
                        {index === 0 && <Clock size={20} />}
                        {index === 1 && <Package size={20} />}
                        {index === 2 && <Truck size={20} />}
                        {index === 3 && <CheckCircle size={20} />}
                        {index === 4 && <CheckCircle size={20} />}
                        
                        {isCurrent && (
                          <motion.div 
                            className="absolute w-14 h-14 border-2 border-emerald-500 rounded-full opacity-50"
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ duration: 1.5, repeat: Infinity }}
                          />
                        )}
                      </div>
                      <span className={`text-xs md:text-sm font-bold uppercase tracking-widest ${
                        isActive ? 'text-zinc-50' : 'text-zinc-600'
                      }`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Order Items Preview */}
            <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {order.items.slice(0, 4).map(item => (
                <div key={`${item.product.id}-${item.size || 'default'}`} className="aspect-3/4 bg-zinc-900 rounded-sm overflow-hidden border border-zinc-800 relative group">
                  <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-zinc-950/80 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center backdrop-blur-sm">
                    <p className="text-xs font-bold uppercase">{item.product.name}</p>
                    <p className="text-xs text-emerald-400 mt-1">Qty {item.quantity}</p>
                    <p className="text-[10px] text-zinc-400 mt-1 uppercase tracking-widest">{item.size || 'One size'}</p>
                  </div>
                </div>
              ))}
              {order.items.length > 4 && (
                <div className="aspect-3/4 bg-zinc-900 border border-zinc-800 rounded-sm flex items-center justify-center text-sm font-bold text-zinc-500">
                  +{order.items.length - 4} More
                </div>
              )}
            </div>

            <div className="relative z-10 mt-8 rounded-3xl border border-zinc-900 bg-zinc-950/70 p-6">
              <p className="text-xs uppercase tracking-[0.35em] text-emerald-400 mb-4">Order items</p>
              <div className="space-y-4">
                {order.items.map((item) => (
                  <div key={`${item.product.id}-${item.size || 'default'}`} className="grid gap-3 md:grid-cols-[1fr_auto] items-center rounded-3xl border border-zinc-900 bg-zinc-900/80 p-4">
                    <div>
                      <p className="font-semibold text-zinc-100">{item.product.name}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500 mt-1">Size: {item.size || 'One size'}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-right text-sm font-semibold text-emerald-300">₱{((item.itemPrice || item.product.price) * item.quantity).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};