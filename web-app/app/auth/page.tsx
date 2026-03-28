"use client";

import { FormEvent, useState } from "react";
import { getMe, register } from "@/app/lib/api";
import { getFirebaseAuth, getGoogleProvider } from "@/app/lib/firebaseClient";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRegisterMessage(null);

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
      setRegisterMessage(response.message || "Registered");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Register failed");
    }
  }

  async function onLogin(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoginMessage(null);

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  async function onGoogleLogin() {
    setError(null);
    setLoginMessage(null);

    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, getGoogleProvider());
      const idToken = await result.user.getIdToken();
      const me = await getMe(idToken);
      const role = me?.data?.role || "USER";
      setLoginMessage(`Google sign-in successful as ${role}. Welcome, ${result.user.displayName || "user"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google login failed");
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-220px)] w-full max-w-6xl px-4 py-8 md:px-8 md:py-12">
      <div className="relative overflow-hidden rounded-[34px] border border-fuchsia-200/40 bg-[radial-gradient(circle_at_20%_20%,#65d8dd_0,#65d8dd_17%,transparent_45%),radial-gradient(circle_at_85%_15%,#ff8f86_0,#ff8f86_18%,transparent_40%),radial-gradient(circle_at_86%_80%,#7ed6ea_0,#7ed6ea_16%,transparent_38%),#f99086] p-4 shadow-[0_24px_80px_rgba(15,23,42,0.20)] md:p-8">
        <div className="relative grid overflow-hidden rounded-[28px] bg-white/94 shadow-[0_16px_50px_rgba(15,23,42,0.16)] md:grid-cols-[1fr_1.05fr]">
          <section className="relative isolate overflow-hidden bg-gradient-to-br from-violet-500 via-violet-500 to-indigo-400 px-8 py-12 text-white md:px-12 md:py-16">
            <div className="pointer-events-none absolute -left-10 -top-10 h-36 w-36 rounded-full bg-cyan-200/25 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-10 h-48 w-48 rounded-full bg-white/12 blur-2xl" />

            <div className="relative mx-auto flex max-w-sm flex-col items-center text-center">
              <div className="mb-8 grid h-28 w-28 place-items-center rounded-full bg-white/18 shadow-inner">
                <span className="text-5xl">💜</span>
              </div>
              <h2 className="text-4xl font-black tracking-[0.22em]">HEALTHCARE</h2>
              <p className="mt-8 max-w-xs text-2xl font-semibold leading-snug text-violet-50/95">
                All your healthcare need on your finger tips
              </p>
            </div>
          </section>

          <section className="relative bg-white px-6 py-8 md:px-14 md:py-14">
            <div className="mx-auto max-w-md">
              <div className="mb-8 flex items-center justify-between">
                <div className="inline-flex rounded-full border border-violet-200 bg-violet-50 p-1 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setMode("login");
                      setError(null);
                    }}
                    className={`rounded-full px-4 py-1.5 transition ${
                      mode === "login" ? "bg-violet-600 text-white" : "text-violet-600 hover:bg-violet-100"
                    }`}
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("register");
                      setError(null);
                    }}
                    className={`rounded-full px-4 py-1.5 transition ${
                      mode === "register" ? "bg-violet-600 text-white" : "text-violet-600 hover:bg-violet-100"
                    }`}
                  >
                    Register
                  </button>
                </div>
              </div>

              {mode === "login" ? (
                <form onSubmit={onLogin} className="space-y-5">
                  <div>
                    <h1 className="text-5xl font-extrabold leading-none text-slate-900">Welcome User</h1>
                    <p className="mt-2 text-3xl font-light text-slate-500">Sign in to continue</p>
                  </div>

                  <div className="space-y-4 pt-3">
                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Email
                      <input
                        name="email"
                        type="email"
                        className="mt-2 h-11 w-full border-0 border-b border-slate-200 bg-transparent px-0 text-base text-slate-800 outline-none transition focus:border-violet-500"
                        required
                      />
                    </label>

                    <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Password
                      <input
                        name="password"
                        type="password"
                        className="mt-2 h-11 w-full border-0 border-b border-slate-200 bg-transparent px-0 text-base text-slate-800 outline-none transition focus:border-violet-500"
                        required
                      />
                    </label>
                  </div>

                  <div className="text-right text-sm">
                    <button type="button" className="font-semibold text-violet-500 hover:text-violet-700">
                      Forget Password ?
                    </button>
                  </div>

                  <button
                    className="h-13 w-full rounded-lg bg-gradient-to-r from-violet-400 to-indigo-400 px-4 py-3 text-xl font-bold text-white shadow-[0_8px_24px_rgba(124,95,255,0.35)] transition hover:brightness-105"
                    type="submit"
                  >
                    SIGN IN
                  </button>

                  <button
                    type="button"
                    onClick={onGoogleLogin}
                    className="h-12 w-full rounded-lg border border-violet-200 bg-white px-4 py-3 text-sm font-semibold text-violet-700 shadow-sm transition hover:bg-violet-50"
                  >
                    Continue with Google
                  </button>

                  {loginMessage && <p className="text-sm font-medium text-emerald-700 break-all">{loginMessage}</p>}
                </form>
              ) : (
                <form onSubmit={onRegister} className="space-y-4">
                  <div>
                    <h1 className="text-4xl font-extrabold leading-none text-slate-900">Create Account</h1>
                    <p className="mt-2 text-2xl font-light text-slate-500">Set up your secure access</p>
                  </div>

                  <input
                    name="name"
                    placeholder="Full Name"
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500"
                    required
                  />
                  <input
                    name="email"
                    type="email"
                    placeholder="Email"
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500"
                    required
                  />
                  <input
                    name="password"
                    type="password"
                    placeholder="Password"
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500"
                    required
                  />
                  <select
                    name="role"
                    className="h-11 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500"
                  >
                    <option>Patient</option>
                    <option>Doctor</option>
                    <option>Admin</option>
                  </select>

                  <button
                    className="h-12 w-full rounded-lg bg-gradient-to-r from-violet-400 to-indigo-400 px-4 py-3 text-lg font-bold text-white shadow-[0_8px_24px_rgba(124,95,255,0.35)] transition hover:brightness-105"
                    type="submit"
                  >
                    CREATE ACCOUNT
                  </button>

                  {registerMessage && <p className="text-sm font-medium text-emerald-700">{registerMessage}</p>}
                </form>
              )}

              {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
