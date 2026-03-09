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
      const response = await login(payload);
      setLoginMessage(`Logged in. Token: ${response.token}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">Authentication (Mock Mode)</h1>
      <p className="text-sm text-neutral-600">
        Starter auth endpoints for Patient / Doctor / Admin. Firebase can replace this flow later.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        <form onSubmit={onRegister} className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Register</h2>
          <input name="name" placeholder="Name" className="w-full rounded border px-3 py-2 text-sm" required />
          <input name="email" type="email" placeholder="Email" className="w-full rounded border px-3 py-2 text-sm" required />
          <input name="password" type="password" placeholder="Password" className="w-full rounded border px-3 py-2 text-sm" required />
          <select name="role" className="w-full rounded border px-3 py-2 text-sm">
            <option>Patient</option>
            <option>Doctor</option>
            <option>Admin</option>
          </select>
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">Register</button>
          {registerMessage && <p className="text-sm text-green-700">{registerMessage}</p>}
        </form>

        <form onSubmit={onLogin} className="space-y-3 rounded border p-4">
          <h2 className="font-semibold">Login</h2>
          <input name="email" type="email" placeholder="Email" className="w-full rounded border px-3 py-2 text-sm" required />
          <input name="password" type="password" placeholder="Password" className="w-full rounded border px-3 py-2 text-sm" required />
          <button className="rounded bg-black px-4 py-2 text-sm text-white" type="submit">Login</button>
          {loginMessage && <p className="text-sm text-green-700 break-all">{loginMessage}</p>}
        </form>
      </div>

      {error && <p className="text-sm text-red-700">{error}</p>}
    </main>
  );
}
