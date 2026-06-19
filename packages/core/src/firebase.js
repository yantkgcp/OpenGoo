import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Fallback / default configs using Vite environment variables or defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// We check if we have a valid configuration. At least apiKey is required.
export const isFirebaseConfigured = !!firebaseConfig.apiKey;

let app;
let dbFirestore;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    dbFirestore = getFirestore(app);
    console.log("🔥 Firebase initialized successfully on project:", firebaseConfig.projectId);
  } catch (error) {
    console.error("❌ Failed to initialize Firebase:", error);
  }
} else {
  console.log("ℹ️ Firebase API Key not detected. Operating in Local Offline Mode.");
}

export { dbFirestore };
