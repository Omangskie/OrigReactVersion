import React, { useState } from 'react';
import { Outlet, Link, useNavigate } from 'react-router';
import { Menu, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { useUserAuth } from '../auth/AuthContext';

export const Layout = () => {
  const { cart } = useStore();
  const { isAdmin, session, signOut } = useUserAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const handleSignOut = async () => {
    const result = await signOut();
    if (result?.success) {
      navigate('/signin');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-sm flex items-center justify-between px-6 py-6 md:px-12 pointer-events-none">
        <Link to="/" className="text-xl font-bold tracking-tighter uppercase pointer-events-auto">
          Originals Printing Co.
        </Link>
        
        {/* <Link to="/" className="pointer-events-auto" aria-label="Originals Printing Co. Home">
          <img
            src="/images/logo.png"
            alt="Originals Printing Co."
            className="h-8 w-auto md:h-10"
          />
        </Link> */}
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium tracking-wide pointer-events-auto">
          <Link to="/shop" className="hover:text-emerald-400 transition-colors">SHOP</Link>
          <Link to="/showcase" className="hover:text-emerald-400 transition-colors">SHOWCASE</Link>
          <Link to="/tracking" className="hover:text-emerald-400 transition-colors">TRACKING</Link>
          {isAdmin && (
            <Link to="/admin" className="hover:text-emerald-400 transition-colors">ADMIN</Link>
          )}
          <Link to="/cart" className="relative hover:text-emerald-400 transition-colors flex items-center gap-2">
            CART
            {cartItemCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-zinc-950">
                {cartItemCount}
              </span>
            )}
          </Link>
          {!session ? (
            <Link to="/signin" className="hover:text-emerald-400 transition-colors">
              SIGN IN
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleSignOut}
              className="hover:text-emerald-400 transition-colors"
            >
              SIGN OUT
            </button>
          )}
        </div>

        <button 
          className="md:hidden pointer-events-auto text-zinc-50"
          onClick={() => setIsMenuOpen(true)}
        >
          <Menu size={24} />
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-60 bg-zinc-950 flex flex-col items-center justify-center gap-8 text-2xl font-bold tracking-widest uppercase">
          <button 
            className="absolute top-6 right-6 p-2"
            onClick={() => setIsMenuOpen(false)}
          >
            <X size={32} />
          </button>
          <Link to="/" className="hover:text-emerald-400" onClick={() => setIsMenuOpen(false)}>Home</Link>
          <Link to="/shop" className="hover:text-emerald-400" onClick={() => setIsMenuOpen(false)}>Shop</Link>
          <Link to="/tracking" className="hover:text-emerald-400" onClick={() => setIsMenuOpen(false)}>Tracking</Link>
          {isAdmin && (
            <Link to="/admin" className="hover:text-emerald-400" onClick={() => setIsMenuOpen(false)}>Admin</Link>
          )}
          <Link to="/cart" className="hover:text-emerald-400 relative" onClick={() => setIsMenuOpen(false)}>
            Cart {cartItemCount > 0 && `(${cartItemCount})`}
          </Link>
        </div>
      )}

      <main className="pt-24 min-h-screen">
        <Outlet />
      </main>

      <footer className="py-12 px-6 md:px-12 border-t border-zinc-900 flex flex-col md:flex-row justify-between items-center gap-6 text-sm text-zinc-500">
        <p>&copy; {new Date().getFullYear()} Originals Printing Co.</p>
        <div className="flex gap-6">
          <Link to="#" className="hover:text-zinc-300">Instagram</Link>
          <Link to="#" className="hover:text-zinc-300">Twitter</Link>
          <Link to="#" className="hover:text-zinc-300">Terms</Link>
        </div>
      </footer>
    </div>
  );
};