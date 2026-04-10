"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  getMyPatientProfile,
  PatientProfile,
  updateMyPatientProfile,
} from "@/app/lib/api";
import { getFirebaseAuth } from "@/app/lib/firebaseClient";

type ProfileForm = {
  phone: string;
  address: string;
  dob: string;
  gender: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  bloodGroup: "" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-";
  allergies: string;
  chronicConditions: string;
};

function mapProfileToForm(profile: PatientProfile): ProfileForm {
  return {
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    dob: profile.dob ? String(profile.dob).slice(0, 10) : "",
    gender: profile.gender || "PREFER_NOT_TO_SAY",
    bloodGroup: profile.bloodGroup ?? "",
    allergies: (profile.allergies || []).join(", "),
    chronicConditions: (profile.chronicConditions || []).join(", "),
  };
}

function parseCsv(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function PatientProfilePage() {
  const router = useRouter();
  const [idToken, setIdToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [form, setForm] = useState<ProfileForm>({
    phone: "",
    address: "",
    dob: "",
    gender: "PREFER_NOT_TO_SAY",
    bloodGroup: "",
    allergies: "",
    chronicConditions: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const auth = getFirebaseAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        setError(null);
        setMessage(null);

        if (!user) {
          router.push("/auth");
          return;
        }

        const token = await user.getIdToken();
        setIdToken(token);

        const result = await getMyPatientProfile(token);
        setProfile(result.data);
        setForm(mapProfileToForm(result.data));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const disabled = useMemo(() => loading || saving || !idToken, [loading, saving, idToken]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!idToken) {
      setError("You must be signed in to update your profile.");
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await updateMyPatientProfile(idToken, {
        phone: form.phone || null,
        address: form.address || null,
        dob: form.dob || null,
        gender: form.gender,
        bloodGroup: form.bloodGroup || null,
        allergies: parseCsv(form.allergies),
        chronicConditions: parseCsv(form.chronicConditions),
      });

      setProfile(response.data);
      setForm(mapProfileToForm(response.data));
      setMessage("Profile updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto min-h-[calc(100vh-220px)] w-full max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Patient profile</p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">Complete your care profile</h1>
          <p className="mt-2 text-sm text-slate-600">
            Keep this profile updated to improve triage, prescriptions, and doctor matching.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-slate-600">Loading profile...</p>
        ) : (
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Full name
              <input
                value={profile?.fullName || ""}
                disabled
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 text-sm text-slate-700"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Email
              <input
                value={profile?.email || ""}
                disabled
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-slate-100 px-3 text-sm text-slate-700"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Phone
              <input
                value={form.phone}
                onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                placeholder="+1 555 000 0000"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Date of birth
              <input
                type="date"
                value={form.dob}
                onChange={(e) => setForm((prev) => ({ ...prev, dob: e.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Gender
              <select
                value={form.gender}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    gender: e.target.value as ProfileForm["gender"],
                  }))
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
              >
                <option value="PREFER_NOT_TO_SAY">Prefer not to say</option>
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Blood group
              <select
                value={form.bloodGroup}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    bloodGroup: e.target.value as ProfileForm["bloodGroup"],
                  }))
                }
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
              >
                <option value="">Select</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Address
              <input
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                placeholder="Street, city, state"
              />
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Allergies (comma separated)
              <input
                value={form.allergies}
                onChange={(e) => setForm((prev) => ({ ...prev, allergies: e.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                placeholder="Penicillin, peanuts"
              />
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Chronic conditions (comma separated)
              <input
                value={form.chronicConditions}
                onChange={(e) => setForm((prev) => ({ ...prev, chronicConditions: e.target.value }))}
                className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-cyan-500"
                placeholder="Diabetes, hypertension"
              />
            </label>

            <div className="md:col-span-2">
              <button
                disabled={disabled}
                className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
              >
                {saving ? "Saving..." : "Save profile"}
              </button>
            </div>
          </form>
        )}

        {message && <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{message}</p>}
        {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </div>
    </main>
  );
}
