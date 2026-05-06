import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuth } from "../auth/AuthContext";

const AdminSignIn = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const { authReady, session, userProfile, signInUser, signOut, isConfiguredAdminEmail } = useUserAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authReady || !session) {
      return;
    }

    if (userProfile?.role === "admin" || isConfiguredAdminEmail(session?.email || "")) {
      navigate("/admin", { replace: true });
    }
  }, [authReady, navigate, session, userProfile, isConfiguredAdminEmail]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signInUser(email, password);

      if (!result.success) {
        setError(result.error || "Unable to sign in.");
        return;
      }

      const isAdminAccount =
        result.profile?.role === "admin" ||
        isConfiguredAdminEmail(result?.data?.user?.email || email);

      if (!isAdminAccount) {
        await signOut();
        setError("This portal is for admin accounts only.");
        return;
      }

      navigate("/admin", { replace: true });
    } catch (authError) {
      setError(authError?.message || "Unable to sign in.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/20 bg-slate-900/80 p-8 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Restricted Access</p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-tight">Admin Sign In</h1>
        <p className="mt-3 text-sm text-zinc-400">
          Use an admin account to access user controls, product moderation, and analytics.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="admin-email" className="block text-sm text-zinc-300 mb-2">Email</label>
            <input
              id="admin-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400"
              placeholder="admin@domain.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="block text-sm text-zinc-300 mb-2">Password</label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-24 text-zinc-100 focus:outline-none focus:border-emerald-400"
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-zinc-300 hover:border-emerald-400 hover:text-emerald-300"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-[0.25em] text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {loading ? "Signing in..." : "Admin Login"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm text-zinc-400">
          <Link to="/signin" className="hover:text-emerald-300 transition-colors">Open normal user sign in</Link>
          <Link to="/admin/signup" className="hover:text-emerald-300 transition-colors">Create admin account</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminSignIn;