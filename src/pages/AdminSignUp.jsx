import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuth } from "../auth/AuthContext";

const passwordChecks = (password) => ({
  minLength: password.length >= 8,
  uppercase: /[A-Z]/.test(password),
  lowercase: /[a-z]/.test(password),
  number: /\d/.test(password),
  symbol: /[^A-Za-z0-9]/.test(password),
});

const AdminSignUp = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const {
    authReady,
    session,
    userProfile,
    users,
    signUpNewUser,
    setUserRole,
    isConfiguredAdminEmail,
  } = useUserAuth();

  const navigate = useNavigate();

  const hasExistingAdmin = useMemo(
    () => users.some((user) => user.role === "admin" && user.status !== "deleted"),
    [users]
  );

  useEffect(() => {
    if (!authReady || !session || loading) {
      return;
    }

    if (!userProfile) {
      return;
    }

    const isAdmin = userProfile?.role === "admin" || isConfiguredAdminEmail(session.email);
    if (isAdmin) {
      navigate("/admin", { replace: true });
      return;
    }

    navigate("/homepage", { replace: true });
  }, [authReady, loading, navigate, session, userProfile, isConfiguredAdminEmail]);

  const checks = passwordChecks(password);
  const validPassword = Object.values(checks).every(Boolean);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit = validPassword && passwordsMatch && email.length > 0;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("Please satisfy the password requirements.");
      return;
    }

    if (hasExistingAdmin && !isConfiguredAdminEmail(email)) {
      setError("This email is not allowed to self-register as admin.");
      return;
    }

    setLoading(true);
    try {
      const result = await signUpNewUser(email, password);

      if (!result.success) {
        setError(result.error || "Unable to create admin account.");
        return;
      }

      const uid = result?.data?.user?.uid;

      if (uid && result.profile?.role !== "admin") {
        await setUserRole(uid, "admin");
      }

      navigate("/admin", { replace: true });
    } catch (signupError) {
      setError(signupError?.message || "Unable to create admin account.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-zinc-50 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-xl rounded-3xl border border-emerald-500/20 bg-slate-900/80 p-8 backdrop-blur-xl">
        <p className="text-xs uppercase tracking-[0.35em] text-emerald-400">Admin Registration</p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-tight">Create Admin Account</h1>
        <p className="mt-3 text-sm text-zinc-400">
          {hasExistingAdmin
            ? "Only allowlisted admin emails can self-register here."
            : "No admin exists yet. The first account created here becomes admin."}
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="admin-signup-email" className="block text-sm text-zinc-300 mb-2">Admin email</label>
            <input
              id="admin-signup-email"
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
            <label htmlFor="admin-signup-password" className="block text-sm text-zinc-300 mb-2">Password</label>
            <input
              id="admin-signup-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400"
              placeholder="Strong password"
              autoComplete="new-password"
            />
          </div>

          <div>
            <label htmlFor="admin-signup-confirm" className="block text-sm text-zinc-300 mb-2">Confirm password</label>
            <input
              id="admin-signup-confirm"
              type="password"
              required
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-zinc-100 focus:outline-none focus:border-emerald-400"
              placeholder="Re-enter password"
              autoComplete="new-password"
            />
          </div>

          <div className="rounded-xl border border-white/10 bg-slate-950/70 p-4 text-xs text-zinc-400 space-y-2">
            <p className={checks.minLength ? "text-emerald-300" : "text-zinc-500"}>At least 8 characters</p>
            <p className={checks.uppercase ? "text-emerald-300" : "text-zinc-500"}>At least one uppercase letter</p>
            <p className={checks.lowercase ? "text-emerald-300" : "text-zinc-500"}>At least one lowercase letter</p>
            <p className={checks.number ? "text-emerald-300" : "text-zinc-500"}>At least one number</p>
            <p className={checks.symbol ? "text-emerald-300" : "text-zinc-500"}>At least one symbol</p>
            <p className={passwordsMatch ? "text-emerald-300" : "text-zinc-500"}>Passwords must match</p>
          </div>

          {error && (
            <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold uppercase tracking-[0.25em] text-slate-950 hover:bg-emerald-300 disabled:opacity-60"
          >
            {loading ? "Creating account..." : "Create Admin Account"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm text-zinc-400">
          <Link to="/admin/signin" className="hover:text-emerald-300 transition-colors">Back to admin login</Link>
          <Link to="/signin" className="hover:text-emerald-300 transition-colors">Open normal user sign in</Link>
        </div>
      </div>
    </div>
  );
};

export default AdminSignUp;