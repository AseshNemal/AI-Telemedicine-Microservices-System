"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, register } from "@/app/lib/api";
import { getFirebaseAuth, getGoogleProvider } from "@/app/lib/firebaseClient";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toFriendlyError(err: unknown) {
    if (!(err instanceof Error)) {
      return "Authentication failed. Please try again.";
    }

    const msg = err.message;

    if (msg.includes("auth/invalid-credential")) {
      return "Invalid email or password.";
    }

    if (msg.includes("auth/popup-closed-by-user")) {
      return "Google sign-in popup was closed before completion.";
    }

    if (msg.includes("auth/network-request-failed")) {
      return "Network error while contacting Firebase. Check your internet and try again.";
    }

    if (msg.includes("Missing Firebase config")) {
      return msg;
    }

    return msg;
  }

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRegisterMessage(null);
    setLoginMessage(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const roleMap = {
      Patient: "PATIENT",
      Doctor: "DOCTOR",
      Admin: "ADMIN",
    } as const;

    const selectedRole = String(form.get("role") || "Patient") as keyof typeof roleMap;

    const payload = {
      fullName: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: roleMap[selectedRole] || "PATIENT",
    };

    try {
      const response = await register(payload);

      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(
        auth,
        payload.email,
        payload.password,
      );
      const idToken = await credential.user.getIdToken();
      const me = await getMe(idToken);
      const role = me?.data?.role || "USER";

      setRegisterMessage(response.message || "Registered");
      setLoginMessage(`Account created and signed in as ${role}.`);
      if (role === "PATIENT") {
        router.push("/patient/profile");
      }
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoginMessage(null);
    setRegisterMessage(null);
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") || "").trim();
    const password = String(form.get("password") || "");

    try {
      const auth = getFirebaseAuth();
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await credential.user.getIdToken();
      const me = await getMe(idToken);
      const role = me?.data?.role || "USER";
      setLoginMessage(`Signed in successfully as ${role}. Your care dashboard is ready.`);
      if (role === "PATIENT") {
        router.push("/patient/profile");
      }
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  async function onGoogleLogin() {
    setError(null);
    setLoginMessage(null);
    setRegisterMessage(null);
    setLoading(true);

    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, getGoogleProvider());
      const idToken = await result.user.getIdToken();
      const me = await getMe(idToken);
      const role = me?.data?.role || "USER";
      setLoginMessage(`Google sign-in successful as ${role}. Welcome, ${result.user.displayName || "user"}.`);
      if (role === "PATIENT") {
        router.push("/patient/profile");
      }
    } catch (err) {
      setError(toFriendlyError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-180px)] w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <div className="overflow-hidden rounded-[30px] border border-slate-200 bg-[linear-gradient(120deg,#0f172a_0%,#102a43_45%,#124559_100%)] shadow-[0_24px_80px_rgba(2,6,23,0.35)]">
        <div className="grid md:grid-cols-[1.05fr_1fr]">
          <section className="relative overflow-hidden px-8 py-12 text-white md:px-12 md:py-14">
            <div className="absolute -left-14 top-12 h-44 w-44 rounded-full bg-cyan-300/20 blur-3xl" />
            <div className="absolute bottom-0 right-0 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
            <div className="relative space-y-5">
              <p className="inline-flex rounded-full border border-cyan-200/40 bg-cyan-100/10 px-3 py-1 text-xs tracking-[0.16em] text-cyan-100">
                TELEMEDICINE ACCESS
              </p>
              <h1 className="max-w-md text-4xl font-black leading-tight md:text-5xl">
                Secure sign-in for every care journey.
              </h1>
              <p className="max-w-md text-base text-slate-100/85 md:text-lg">
                Use your email or Google account to access appointments, records, and tele-consultation sessions.
              </p>
              <div className="mt-8 grid max-w-md grid-cols-3 gap-3 text-xs text-slate-100/90">
                <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">OAuth</div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">JWT Ready</div>
                <div className="rounded-xl border border-white/20 bg-white/10 px-3 py-2">HIPAA-minded</div>
              </div>
            </div>
          </section>

          <section className="bg-white px-6 py-8 md:px-10 md:py-10">
            <div className="mx-auto max-w-md space-y-5">
              <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1 text-sm font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode("login");
                    setError(null);
                  }}
                  className={`rounded-full px-4 py-1.5 transition ${
                    mode === "login" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode("register");
                    setError(null);
                  }}
                  className={`rounded-full px-4 py-1.5 transition ${
                    mode === "register" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  Register
                </button>
              </div>

              {mode === "login" ? (
                <form onSubmit={onLogin} className="space-y-4">
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-900">Welcome back</h2>
                    <p className="text-slate-600">Login with your Firebase credentials.</p>
                  </div>

                  <label className="block text-sm font-medium text-slate-700">
                    Email
                    <input
                      name="email"
                      type="email"
                      className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-cyan-500"
                      required
                    />
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Password
                    <input
                      name="password"
                      type="password"
                      className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none transition focus:border-cyan-500"
                      required
                    />
                  </label>

                  <button
                    className="h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Login"}
                  </button>

                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    disabled={loading}
                    className="h-11 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Continue with Google
                  </button>
                </form>
              ) : (
                <form onSubmit={onRegister} className="space-y-4">
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-900">Create account</h2>
                    <p className="text-slate-600">Register in auth-service and sign in instantly.</p>
                  </div>

                  <input
                    name="name"
                    placeholder="Full Name"
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                    required
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                    required
                  />
                  <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                    required
                  />
                  <select
                    name="role"
                    className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                  >
                    <option>Patient</option>
                    <option>Doctor</option>
                    <option>Admin</option>
                  </select>

                  <button
                    className="h-11 w-full rounded-xl bg-amber-500 px-4 text-sm font-bold text-slate-900 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                    type="submit"
                    disabled={loading}
                  >
                    {loading ? "Creating account..." : "Create account"}
                  </button>
                </form>
              )}

              {loginMessage && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{loginMessage}</p>}
              {registerMessage && <p className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-700">{registerMessage}</p>}
              {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
