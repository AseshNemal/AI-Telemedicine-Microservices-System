import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

let provider: GoogleAuthProvider | null = null;

function getFirebaseConfig() {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;

  if (!apiKey || !projectId || !authDomain) {
    throw new Error(
      "Missing Firebase config. Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID, and NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN.",
    );
  }

  return {
    apiKey,
    projectId,
    authDomain,
  };
}

export function getFirebaseAuth() {
  const app = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
  return getAuth(app);
}

export function getGoogleProvider() {
  if (!provider) {
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
  }
  return provider;
}
