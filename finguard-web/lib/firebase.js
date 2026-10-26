
import { initializeApp, getApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Check required configuration without printing credentials.
const requiredKeys = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
];

const missingKeys = requiredKeys.filter(
  (key) => !firebaseConfig[key]
);

if (missingKeys.length > 0) {
  throw new Error(
    `Missing Firebase configuration: ${missingKeys.join(", ")}. Check your .env.local file.`
  );
}

const app = getApps().length
  ? getApp()
  : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
