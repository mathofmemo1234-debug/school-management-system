import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration for Al Noor School
const firebaseConfig = {
  apiKey: "AIzaSyDoLuzPsKZeMSDfxOGWpE-aBmG2PzKWcTo",
  authDomain: "al-noor-school-b2d7e.firebaseapp.com",
  projectId: "al-noor-school-b2d7e",
  storageBucket: "al-noor-school-b2d7e.firebasestorage.app",
  messagingSenderId: "907983588153",
  appId: "1:907983588153:web:aa4f77d5098d208680b6e8"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Ensure session persists after page refresh
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();
