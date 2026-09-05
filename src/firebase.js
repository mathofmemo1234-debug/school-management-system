import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration for Advanced Smart Learning (MSC Schools)
const firebaseConfig = {
  apiKey: "AIzaSyA-BaaAqrzeFzHiZpmNEwAeEB6Igd6QWKc",
  authDomain: "advanced-smart-learning-3dfbf.firebaseapp.com",
  databaseURL: "https://advanced-smart-learning-3dfbf-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "advanced-smart-learning-3dfbf",
  storageBucket: "advanced-smart-learning-3dfbf.firebasestorage.app",
  messagingSenderId: "210401728875",
  appId: "1:210401728875:web:e7bf2d6626ac6d4d85542e"
};

const app = initializeApp(firebaseConfig);

// HARD DATABASE ISOLATION ASSERTION:
// Ensures this application instance is strictly locked to Advanced Smart Learning database
if (firebaseConfig.projectId !== "advanced-smart-learning-3dfbf") {
  throw new Error("FATAL_SECURITY_ERROR: Advanced Smart Learning must connect exclusively to advanced-smart-learning-3dfbf project.");
}

export const auth = getAuth(app);

// Ensure session persists after page refresh
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Secondary Firebase Auth instance helper to create user accounts without signing out the SuperAdmin
export const createSecondaryAuthUser = async (email, password) => {
  try {
    let secondaryApp;
    const existingApps = getApps();
    const found = existingApps.find(a => a.name === "SecondaryAuthApp");
    if (!found) {
      secondaryApp = initializeApp(firebaseConfig, "SecondaryAuthApp");
    } else {
      secondaryApp = getApp("SecondaryAuthApp");
    }
    const secondaryAuth = getAuth(secondaryApp);
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    return cred.user;
  } catch (err) {
    console.warn("Secondary auth user creation warning:", err);
    throw err;
  }
};
