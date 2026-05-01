import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { CheckCircle, Loader2, Smartphone } from 'lucide-react';

export const Checkout = () => {
  const { cart, cartTotal, placeOrder } = useStore();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [orderId, setOrderId] = useState('');
  const [shippingSubmitted, setShippingSubmitted] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentIntentId, setPaymentIntentId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('idle');
  const [paymentMessage, setPaymentMessage] = useState('');
  const [creatingSession, setCreatingSession] = useState(false);
  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentCheckoutUrl, setPaymentCheckoutUrl] = useState('');
  const [paymentConfigHint, setPaymentConfigHint] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [stateProvince, setStateProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const shouldRedirectToCart = cart.length === 0 && !completed;

  useEffect(() => {
    if (shouldRedirectToCart) {
      navigate('/cart');
    }
  }, [shouldRedirectToCart, navigate]);

  const parseApiJson = async (response) => {
    const text = await response.text();
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  };

  const createPaymentSession = async () => {
    const generatedReference = `ORIG-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    const requestBody = {
      reference: generatedReference,
      amount: cartTotal,
      description: `Originals Printing order ${generatedReference}`,
      customerEmail: contactEmail,
      customerName: `${firstName} ${lastName}`.trim(),
      customerPhone: '',
      customerAddress: {
        line1: addressLine,
        city,
        state: stateProvince,
        postal_code: postalCode,
        country: 'PH',
      },
    };

    setCreatingSession(true);
    setPaymentError('');
    setPaymentConfigHint('');
    setPaymentStatus('creating');
    setPaymentMessage('Creating PayMongo payment session...');
    setPaymentIntentId('');

    try {
      const response = await fetch('/api/payments/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await parseApiJson(response);
      if (!response.ok) {
        if (data?.hint) {
          setPaymentConfigHint(data.hint);
        }

        if (!data?.hint && [502, 503, 504].includes(response.status)) {
          setPaymentConfigHint('Payment API appears offline. Start it with: npm run api (or npm run dev).');
        }

        throw new Error(
          data?.message ||
            ([502, 503, 504].includes(response.status)
              ? 'Payment API is unreachable. Start it with: npm run api'
              : `Unable to create payment session. HTTP ${response.status}`)
        );
      }

      if (!data) {
        throw new Error('Payment API returned an empty response. Check API logs and PayMongo key.');
      }

      setPaymentReference(data.reference || generatedReference);
      setPaymentIntentId(data.paymentIntentId || '');
      setPaymentQrUrl(data.qrImageUrl || '');
      setPaymentCheckoutUrl(data.checkoutUrl || '');

      if (data.paymongoKeyMode === 'test') {
        setPaymentConfirmed(true);
        setPaymentStatus('paid');
        setPaymentMessage('Test mode detected. QR generated and payment auto-confirmed for checkout flow.');
        setPaymentError('');
        return;
      }

      setPaymentStatus('waiting');
      setPaymentMessage('Payment session ready. Scan QR with GCash or open PayMongo checkout.');
    } catch (error) {
      setPaymentStatus('failed');
      setPaymentMessage('');
      if (error instanceof TypeError) {
        setPaymentError('Payment API is unreachable. Start it with: npm run api');
      } else {
        setPaymentError(error?.message || 'Failed to create PayMongo payment session.');
      }
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();

    if (!shippingSubmitted) {
      setShippingSubmitted(true);
      await createPaymentSession();
      return;
    }

    if (!paymentConfirmed) {
      setPaymentError('Click Payment Confirmed to place the order.');
      return;
    }
  };

  useEffect(() => {
    if (!shippingSubmitted || paymentConfirmed || !paymentReference || !paymentIntentId) {
      return;
    }

    let cancelled = false;

    const verifyPaymentStatus = async () => {
      try {
        const response = await fetch(
          `/api/payments/status/${paymentReference}?paymentIntentId=${encodeURIComponent(paymentIntentId)}`
        );
        const data = await parseApiJson(response);

        if (!response.ok) {
          if (!cancelled && response.status === 404) {
            setPaymentStatus('waiting');
            setPaymentMessage('Payment session is still initializing...');
          }

          if (!cancelled && response.status >= 500) {
            setPaymentError('Payment API error while checking status. Verify PAYMONGO_SECRET_KEY and npm run api.');
          }
          return;
        }

        if (!cancelled && data?.status === 'paid') {
          setPaymentConfirmed(true);
          setPaymentStatus('paid');
          setPaymentMessage('Payment detected and confirmed by the system.');
          setPaymentError('');
          return;
        }

        if (!cancelled && data?.status === 'expired') {
          setPaymentStatus('expired');
          setPaymentMessage('Payment session expired. Please refresh checkout and try again.');
          setPaymentError('');
          return;
        }

        if (!cancelled) {
          setPaymentStatus('waiting');
          setPaymentMessage('Waiting for payment confirmation from PayMongo...');
        }
      } catch {
        if (!cancelled) {
          setPaymentError('Cannot verify payment right now. Ensure API server is running.');
        }
      }
    };

    verifyPaymentStatus();
    const interval = setInterval(verifyPaymentStatus, 3000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [shippingSubmitted, paymentConfirmed, paymentReference, paymentIntentId]);

  const handlePaymentConfirmed = () => {
    if (!paymentConfirmed || processing || completed) {
      return;
    }

    setProcessing(true);
    try {
      const id = placeOrder();
      setOrderId(id);
      setCompleted(true);
      setPaymentError('');
      setPaymentMessage('Order placed successfully.');
    } catch {
      setPaymentError('Unable to complete checkout. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRedirectToGcash = () => {
    const targetUrl = paymentCheckoutUrl || paymentQrUrl;

    if (!targetUrl) {
      setPaymentError('Payment session is not available yet. Please wait for the QR code.');
      return;
    }

    setPaymentError('');
    setPaymentStatus(paymentCheckoutUrl ? 'verifying' : 'waiting');
    setPaymentMessage(paymentCheckoutUrl ? 'Opening PayMongo checkout. Complete payment with GCash, then return here.' : 'Opening the QR code in a new tab. Scan it with GCash or a QR-enabled banking app.');

    const popup = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!popup) {
      window.location.href = targetUrl;
    }
  };

  if (shouldRedirectToCart) {
    return null;
  }

  if (completed) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center px-6 text-center">
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
          className="text-emerald-500 mb-8"
        >
          <CheckCircle size={80} />
        </motion.div>
        
        <h1 className="text-4xl md:text-6xl font-bold tracking-tighter uppercase mb-6">Order Placed</h1>
        <p className="text-xl font-light text-zinc-400 mb-2">Order #{orderId}</p>
        <p className="text-zinc-500 mb-12 max-w-md">Your order has been confirmed. You will receive an email shortly.</p>
        
        <div className="flex flex-col sm:flex-row gap-6">
          <button 
            onClick={() => navigate('/tracking')}
            className="py-4 px-8 bg-zinc-50 text-zinc-950 font-bold tracking-widest uppercase hover:bg-emerald-400 transition-colors"
          >
            Track Order
          </button>
          <button 
            onClick={() => navigate('/shop')}
            className="py-4 px-8 border border-zinc-800 text-zinc-50 font-bold tracking-widest uppercase hover:border-emerald-500 hover:text-emerald-400 transition-colors"
          >
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 md:px-12 py-12 max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16">
      <div>
        <h1 className="text-4xl md:text-5xl font-bold tracking-tighter uppercase mb-12">Checkout</h1>
        
        <form onSubmit={handleCheckout} className="space-y-6">
          <div className="space-y-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-500 mb-6">Contact Info</h2>
            <input required type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="Email Address" className="w-full bg-zinc-900 border border-zinc-800 p-4 focus:outline-none focus:border-emerald-500 transition-colors text-zinc-50" />
            <div className="grid grid-cols-2 gap-4">
              <input required type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" className="w-full bg-zinc-900 border border-zinc-800 p-4 focus:outline-none focus:border-emerald-500 transition-colors text-zinc-50" />
              <input required type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" className="w-full bg-zinc-900 border border-zinc-800 p-4 focus:outline-none focus:border-emerald-500 transition-colors text-zinc-50" />
            </div>
          </div>

          <div className="space-y-4 pt-8 border-t border-zinc-900">
            <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-500 mb-6">Shipping</h2>
            <input required type="text" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Address" className="w-full bg-zinc-900 border border-zinc-800 p-4 focus:outline-none focus:border-emerald-500 transition-colors text-zinc-50" />
            <input required type="text" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" className="w-full bg-zinc-900 border border-zinc-800 p-4 focus:outline-none focus:border-emerald-500 transition-colors text-zinc-50" />
            <div className="grid grid-cols-2 gap-4">
              <input required type="text" value={stateProvince} onChange={(e) => setStateProvince(e.target.value)} placeholder="State/Province" className="w-full bg-zinc-900 border border-zinc-800 p-4 focus:outline-none focus:border-emerald-500 transition-colors text-zinc-50" />
              <input required type="text" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="Postal Code" className="w-full bg-zinc-900 border border-zinc-800 p-4 focus:outline-none focus:border-emerald-500 transition-colors text-zinc-50" />
            </div>
          </div>

          {shippingSubmitted && (
            <div className="space-y-5 pt-8 border-t border-zinc-900">
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-500">Payment</h2>
              <p className="text-sm text-zinc-400">Pay via PayMongo using GCash or QR-enabled banking app.</p>

              <div className="border border-zinc-800 bg-zinc-950 p-5 space-y-4">
                <div className="bg-white p-3 w-max mx-auto rounded-sm">
                  {paymentQrUrl ? (
                    <img
                      src={paymentQrUrl}
                      alt="PayMongo checkout QR code"
                      className="w-40 h-40 object-contain"
                    />
                  ) : (
                    <div className="w-40 h-40 grid place-items-center text-center text-[11px] text-zinc-600 px-3">
                      {creatingSession ? 'Preparing QR...' : 'QR unavailable'}
                    </div>
                  )}
                </div>
                <p className="text-xs text-zinc-400 text-center">Ref: {paymentReference || 'Pending'} • Amount: ₱{cartTotal.toFixed(2)}</p>

                <button
                  type="button"
                  onClick={handlePaymentConfirmed}
                  disabled={!paymentConfirmed || processing || completed}
                  className="w-full py-3 border border-zinc-700 font-bold uppercase tracking-widest text-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-50 text-zinc-950 hover:bg-emerald-400"
                >
                  {paymentStatus === 'creating' && 'Creating Payment Session'}
                  {paymentStatus === 'verifying' && 'Checking Payment'}
                  {paymentStatus === 'paid' && 'Payment Confirmed'}
                  {paymentStatus === 'expired' && 'Payment Session Expired'}
                  {(paymentStatus === 'waiting' || paymentStatus === 'idle' || paymentStatus === 'failed') && 'Awaiting Payment Confirmation'}
                </button>

                <button
                  type="button"
                  onClick={handleRedirectToGcash}
                  disabled={creatingSession || (!paymentCheckoutUrl && !paymentQrUrl)}
                  className="w-full py-3 border border-zinc-700 text-zinc-100 font-bold uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Smartphone size={16} />
                  Open Payment
                </button>
              </div>

              {paymentMessage && (
                <p className={`text-sm ${paymentConfirmed ? 'text-emerald-400' : 'text-zinc-400'}`}>{paymentMessage}</p>
              )}

              {paymentError && <p className="text-sm text-red-400">{paymentError}</p>}
              {paymentConfigHint && <p className="text-xs text-amber-400">{paymentConfigHint}</p>}
            </div>
          )}

          <button 
            type="submit" 
            disabled={processing || shippingSubmitted}
            className="w-full mt-12 py-5 bg-zinc-50 text-zinc-950 font-bold tracking-widest uppercase hover:bg-emerald-400 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Processing...
              </>
            ) : (
              shippingSubmitted ? (creatingSession ? 'Preparing Payment Session...' : 'Waiting for Payment Confirmation') : 'Continue to Payment'
            )}
          </button>
        </form>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 p-8 h-max">
        <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-500 mb-8">Order Summary</h2>
        <div className="space-y-6 mb-8 max-h-[40vh] overflow-y-auto hide-scrollbar">
          {cart.map(item => (
            <div key={`${item.product.id}-${item.size || 'default'}`} className="border border-zinc-800 rounded p-3 bg-zinc-950/50">
              <div className="flex gap-4 mb-3">
                <div className="w-16 h-20 bg-zinc-950 rounded-sm overflow-hidden shrink-0">
                  <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                <div className="grow flex flex-col justify-center">
                  <div className="flex justify-between items-start">
                    <h3 className="font-bold text-sm uppercase tracking-wider">{item.product.name}</h3>
                    <p className="font-medium">₱{((item.itemPrice || item.product.price) * item.quantity).toFixed(2)}</p>
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">Qty: {item.quantity} • Size: {item.size || 'One size'}</p>
                </div>
              </div>
              {item.layoutImage && (
                <div className="pt-3 border-t border-zinc-700">
                  <p className="text-xs text-emerald-400 mb-2 font-semibold">✓ Layout Uploaded</p>
                  <img src={item.layoutImage} alt="Layout" className="w-full h-auto max-h-24 object-contain rounded" />
                </div>
              )}
              {!item.layoutImage && (
                <div className="pt-3 border-t border-zinc-700">
                  <p className="text-xs text-amber-500">⚠ No layout uploaded yet</p>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="pt-6 border-t border-zinc-800 flex justify-between items-center text-xl font-bold">
          <span className="uppercase tracking-widest">Total</span>
          <span className="text-emerald-400">₱{cartTotal.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};