import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useUserAuth } from "../auth/AuthContext";

const SignIn = () => {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberMe, setRememberMe] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [forgotMode, setForgotMode] = useState(false);
    const [resetOtpStage, setResetOtpStage] = useState(false);
    const [resetOtpCode, setResetOtpCode] = useState("");
    const [forgotMessage, setForgotMessage] = useState("");
    const [forgotError, setForgotError] = useState("");
    const [forgotLoading, setForgotLoading] = useState(false);
    const [error, setError] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [errorCode, setErrorCode] = useState("");
    const [loading, setLoading] = useState(false);

    const {session, userProfile, authReady, signInUser, signUpNewUser, resetUserPassword, checkEmailVerification, isConfiguredAdminEmail} = useUserAuth();
    const navigate =  useNavigate();

    useEffect(() => {
        const savedEmail = localStorage.getItem("rememberedEmail");
        if (savedEmail) {
            setEmail(savedEmail);
            setRememberMe(true);
        }
    }, []);

    const handleSignIn = async (e) => {
        e.preventDefault();
        setError("");
        setSuccessMessage("");
        setErrorCode("");
        setLoading(true);
        try {
            const result = await signInUser(email, password);
            if (result.success) {
                if (rememberMe) {
                    localStorage.setItem("rememberedEmail", email);
                } else {
                    localStorage.removeItem("rememberedEmail");
                }
                console.log("User signed in successfully:", result.data);
                navigate(result.profile?.role === "admin" ? "/admin" : "/homepage");
                return;
            }
            setError(result.error || "Unable to sign in. Please try again.");
            setErrorCode(result.code || "");
        } catch (error) {
            setError(error.message);
            setErrorCode("");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateAccount = async () => {
        setError("");
        setSuccessMessage("");
        setErrorCode("");
        setLoading(true);
        try {
            const result = await signUpNewUser(email, password);
            if (result.success) {
                setSuccessMessage(result.message || "Account created. Verify your email before signing in.");
                return;
            }
            setError(result.error || "Unable to create account. Please try again.");
            setErrorCode(result.code || "");
        } catch (error) {
            setError(error.message || "Unable to create account.");
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = () => {
        setForgotMode(true);
        setForgotError("");
        setForgotMessage("");
        setResetOtpStage(false);
        setResetOtpCode("");
    };

    const handleSendResetOtp = async () => {
        setForgotError("");
        setForgotMessage("");
        setForgotLoading(true);

        if (!email) {
            setForgotError("Please enter your email to continue.");
            setForgotLoading(false);
            return;
        }

        try {
            const response = await fetch("/api/auth/send-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email }),
            });

            const payload = await response.json();
            if (!response.ok) {
                throw new Error(payload?.message || "Unable to send reset code.");
            }

            setResetOtpStage(true);
            setForgotMessage(payload?.message || "Check your email for the verification code.");
        } catch (error) {
            setForgotError(error.message || "Unable to send reset code. Please try again.");
        } finally {
            setForgotLoading(false);
        }
    };

    const handleVerifyOtpAndSendReset = async (e) => {
        e.preventDefault();
        setForgotError("");
        setForgotMessage("");
        setForgotLoading(true);

        if (!email) {
            setForgotError("Email is required to verify the code.");
            setForgotLoading(false);
            return;
        }
        if (!resetOtpCode) {
            setForgotError("Please enter the verification code sent to your email.");
            setForgotLoading(false);
            return;
        }

        try {
            const verifyResponse = await fetch("/api/auth/verify-otp", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, code: resetOtpCode }),
            });

            const verifyPayload = await verifyResponse.json();
            if (!verifyResponse.ok) {
                throw new Error(verifyPayload?.message || "Invalid verification code.");
            }

            const resetResult = await resetUserPassword(email);
            if (!resetResult.success) {
                throw new Error(resetResult.error || "Failed to send password reset email.");
            }

            setForgotMessage("Verification succeeded. A password reset email has been sent.");
            setForgotMode(false);
            setResetOtpStage(false);
            setResetOtpCode("");
        } catch (error) {
            setForgotError(error.message || "Unable to verify code or send reset instructions.");
        } finally {
            setForgotLoading(false);
        }
    };

    const handleCancelForgot = () => {
        setForgotMode(false);
        setForgotError("");
        setForgotMessage("");
        setResetOtpStage(false);
        setResetOtpCode("");
    };

    useEffect(() => {
        if (authReady && session) {
            const isAdmin = userProfile?.role === "admin" || isConfiguredAdminEmail(session.email);
            navigate(isAdmin ? "/admin" : "/homepage");
        }
    }, [authReady, session, userProfile, navigate, isConfiguredAdminEmail]);

    useEffect(() => {
        if (errorCode !== "auth/email-not-verified") {
            return undefined;
        }

        const intervalId = setInterval(async () => {
            const result = await checkEmailVerification();
            if (result.success && result.verified) {
                navigate(userProfile?.role === "admin" ? "/admin" : "/homepage");
            }
        }, 3000);

        return () => clearInterval(intervalId);
    }, [errorCode, checkEmailVerification, navigate, userProfile]);


    return (
        <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-white">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_22%),radial-gradient(circle_at_bottom_right,rgba(6,182,212,0.12),transparent_25%)]" />
            <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12">
                <div className="w-full overflow-hidden rounded-4xl border border-white/10 bg-white/5 shadow-2xl shadow-black/40 backdrop-blur-2xl">
                    <div className="grid gap-8 md:grid-cols-[1.05fr_0.95fr]">
                        <div className="space-y-6 px-8 py-10 md:px-12 md:py-14">
                            <span className="inline-flex rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-1 text-xs uppercase tracking-[0.35em] text-emerald-300">
                                Originals Printing Co.
                            </span>
                            <div className="space-y-4">
                                <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                                    Welcome back.
                                </h1>
                                <p className="max-w-xl text-zinc-300">
                                    Sign in and continue shopping with the same premium modern experience as the home page.
                                </p>
                            </div>
                            <div className="rounded-3xl border border-white/10 bg-zinc-950/80 p-6 text-sm text-zinc-300 shadow-xl shadow-black/20">
                                <p className="font-semibold text-white">Need help?</p>
                                <p className="mt-2 leading-7">
                                    Enter your registered email and password to access orders, cart data, and personalized recommendations.
                                </p>
                            </div>
                        </div>
                        <div className="relative overflow-hidden rounded-4xl bg-zinc-950/90 px-8 py-10 md:px-12 md:py-14">
                            <div className="absolute inset-x-0 top-0 h-28 bg-linear-to-b from-emerald-500/10 to-transparent" />
                            <div className="relative">
                                <button type="button" className="absolute right-4 top-4 text-zinc-400 transition hover:text-white" onClick={() => navigate("/") }>
                                    &times;
                                </button>
                                <div className="mb-8">
                                    <p className="text-sm uppercase tracking-[0.35em] text-emerald-300">{forgotMode ? "Forgot Password" : "Sign in"}</p>
                                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-white">Continue to Originals</h2>
                                </div>
                                {forgotMode ? (
                                    <form onSubmit={handleVerifyOtpAndSendReset} className="space-y-6">
                                        <div className="space-y-3">
                                            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">Email address</label>
                                            <input
                                                id="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                type="email"
                                                required
                                                autoComplete="email"
                                                placeholder="sample@gmail.com"
                                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                                            />
                                        </div>
                                        {resetOtpStage ? (
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <label htmlFor="reset-code" className="text-sm font-medium text-zinc-300">Verification code</label>
                                                    <button
                                                        type="button"
                                                        onClick={handleSendResetOtp}
                                                        disabled={forgotLoading}
                                                        className="text-sm font-semibold text-amber-400 hover:text-amber-300"
                                                    >
                                                        Resend code
                                                    </button>
                                                </div>
                                                <input
                                                    id="reset-code"
                                                    value={resetOtpCode}
                                                    onChange={(e) => setResetOtpCode(e.target.value)}
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    required
                                                    placeholder="Enter code"
                                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                                                />
                                            </div>
                                        ) : (
                                            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                                                <p>Enter your email and click below to receive a verification code.</p>
                                            </div>
                                        )}
                                        <button
                                            type={resetOtpStage ? "submit" : "button"}
                                            onClick={resetOtpStage ? undefined : handleSendResetOtp}
                                            disabled={forgotLoading}
                                            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {forgotLoading
                                                ? "Please wait..."
                                                : resetOtpStage
                                                    ? "Verify code & send reset link"
                                                    : "Send verification code"
                                            }
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCancelForgot}
                                            className="w-full rounded-2xl border border-white/10 bg-zinc-900/80 px-4 py-3 text-sm font-semibold text-zinc-200 transition hover:bg-white/5"
                                        >
                                            Back to sign in
                                        </button>
                                        {forgotMessage && <p className="text-sm text-emerald-300">{forgotMessage}</p>}
                                        {forgotError && <p className="text-sm text-red-400">{forgotError}</p>}
                                    </form>
                                ) : (
                                    <form onSubmit={handleSignIn} className="space-y-6">
                                        <div className="space-y-3">
                                            <label htmlFor="email" className="block text-sm font-medium text-zinc-300">Email address</label>
                                            <input
                                                id="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                type="email"
                                                required
                                                autoComplete="email"
                                                placeholder="sample@gmail.com"
                                                className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-zinc-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                                            />
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <label htmlFor="password" className="text-sm font-medium text-zinc-300">Password</label>
                                                <button
                                                    type="button"
                                                    className="text-sm font-semibold text-amber-400 hover:text-amber-300"
                                                    onClick={handleForgotPassword}
                                                >
                                                    Forgot password?
                                                </button>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    id="password"
                                                    value={password}
                                                    onChange={(e) => setPassword(e.target.value)}
                                                    type={showPassword ? "text" : "password"}
                                                    required
                                                    autoComplete="current-password"
                                                    placeholder="Sample@123"
                                                    className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 pr-12 text-white placeholder:text-zinc-500 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-400/20"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword((prev) => !prev)}
                                                    className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-white"
                                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                                >
                                                    {showPassword ? "Hide" : "Show"}
                                                </button>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-zinc-300">
                                            <input
                                                id="remember-me"
                                                type="checkbox"
                                                checked={rememberMe}
                                                onChange={(e) => setRememberMe(e.target.checked)}
                                                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                                            />
                                            <label htmlFor="remember-me" className="cursor-pointer text-sm text-zinc-200">
                                                Remember me
                                            </label>
                                        </div>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {loading ? "Please wait..." : "Sign in"}
                                        </button>
                                        {errorCode === "auth/invalid-credential" && email && password && (
                                            <button
                                                type="button"
                                                onClick={handleCreateAccount}
                                                disabled={loading}
                                                className="w-full rounded-2xl border border-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/10 disabled:opacity-60"
                                            >
                                                Create account with this email
                                            </button>
                                        )}
                                        {successMessage && <p className="text-sm text-emerald-300">{successMessage}</p>}
                                        {error && <p className="text-sm text-red-400">{error}</p>}
                                    </form>
                                )}
                                <p className="mt-8 text-center text-sm text-zinc-400">
                                    Don&apos;t have an account?{' '}
                                    <Link to="/signup" className="font-semibold text-amber-400 hover:text-amber-300">
                                        Sign up here!
                                    </Link>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignIn;
