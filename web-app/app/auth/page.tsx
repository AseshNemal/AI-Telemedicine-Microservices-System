"use client";

import { FormEvent, useState } from "react";
import { login, register } from "@/app/lib/api";

export default function AuthPage() {
  const [registerMessage, setRegisterMessage] = useState<string | null>(null);
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRegister(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setRegisterMessage(null);

    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get("name") || ""),
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
      role: String(form.get("role") || "Patient") as "Patient" | "Doctor" | "Admin",
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
    const payload = {
      email: String(form.get("email") || ""),
      password: String(form.get("password") || ""),
    };

    try {
      await login(payload);
      setLoginMessage("Signed in successfully. Your care dashboard is ready.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="page-shell">
      <section className="hero-shell">
        <p className="section-kicker">Secure access</p>
        <h1 className="section-title">Sign in to your telemedicine care workspace</h1>
        <p className="section-subtitle">
          Patients, clinicians, and administrators can safely access care tools, appointment workflows,
          and health records using role-based authentication.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">01</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Create account</h3>
            <p className="mt-1 text-xs text-slate-600">Set up your profile and choose your care role.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">02</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Sign in securely</h3>
            <p className="mt-1 text-xs text-slate-600">Access personalized care pathways with confidence.</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white/90 p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">03</p>
            <h3 className="mt-1 text-sm font-semibold text-slate-900">Start consultation</h3>
            <p className="mt-1 text-xs text-slate-600">Continue to doctors, bookings, and follow-up care.</p>
          </article>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={onRegister} className="surface-card space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Create your account</h2>
          <p className="text-sm text-slate-600">Join as a patient, doctor, or administrator.</p>
          <input name="name" placeholder="Name" className="field-input w-full" required />
          <input name="email" type="email" placeholder="Email" className="field-input w-full" required />
          <input name="password" type="password" placeholder="Password" className="field-input w-full" required />
          <select name="role" className="field-input w-full">
            <option>Patient</option>
            <option>Doctor</option>
            <option>Admin</option>
          </select>
          <button className="btn-primary" type="submit">Create account</button>
          {registerMessage && <p className="text-sm text-green-700">{registerMessage}</p>}
        </form>

        <form onSubmit={onLogin} className="surface-card space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Welcome back</h2>
          <p className="text-sm text-slate-600">Sign in to continue your digital care journey.</p>
          <input name="email" type="email" placeholder="Email" className="field-input w-full" required />
          <input name="password" type="password" placeholder="Password" className="field-input w-full" required />
          <button className="btn-primary" type="submit">Sign in</button>
          {loginMessage && <p className="text-sm text-green-700 break-all">{loginMessage}</p>}
        </form>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </main>
  );
}
