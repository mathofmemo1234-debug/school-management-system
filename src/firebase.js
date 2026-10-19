import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Firebase configuration for Advanced Smart Learning (MSC Schools - Dammam Region me-central2)
const firebaseConfig = {
  apiKey: "AIzaSyBQHK4ozDDYoNXodi-k6ivhW4c5-rV0qJA",
  authDomain: "school-system-dammam.firebaseapp.com",
  projectId: "school-system-dammam",
  storageBucket: "school-system-dammam.firebasestorage.app",
  messagingSenderId: "432965293500",
  appId: "1:432965293500:web:751d6f07265eb31ded47b9"
};

const app = initializeApp(firebaseConfig);

// HARD DATABASE ISOLATION ASSERTION:
// Ensures this application instance is strictly locked to school-system-dammam database
if (firebaseConfig.projectId !== "school-system-dammam") {
  throw new Error("FATAL_SECURITY_ERROR: Advanced Smart Learning must connect exclusively to school-system-dammam project.");
}

export const auth = getAuth(app);

// Ensure session persists after page refresh
setPersistence(auth, browserLocalPersistence).catch(console.error);

export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Secondary Firebase Auth instance helper to create user accounts without signing out the SuperAdmin
export const createSecondaryAuthUser = async (email, password, userData = null) => {
  let secondaryApp;
  try {
    const existingApps = getApps();
    const found = existingApps.find(a => a.name === "SecondaryAuthApp");
    if (!found) {
      secondaryApp = initializeApp(firebaseConfig, "SecondaryAuthApp");
    } else {
      secondaryApp = getApp("SecondaryAuthApp");
    }
  } catch (appErr) {
    console.warn("Secondary app init warning:", appErr);
    secondaryApp = app;
  }

  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getFirestore(secondaryApp);

  let user = null;
  try {
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    user = cred.user;
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, email, password);
        user = cred.user;
      } catch (signInErr) {
        console.warn("Could not sign in existing user in secondary auth:", signInErr);
      }
    } else {
      console.warn("Secondary auth user creation warning:", err);
    }
  }

  // If userData is provided and user is authenticated in secondary app, write directly to secondaryDb (authenticated request)
  if (userData && user) {
    try {
      await setDoc(doc(secondaryDb, 'users', user.uid), { ...userData, uid: user.uid }, { merge: true });
    } catch (secDbErr) {
      console.warn("SecondaryDb direct write notice:", secDbErr);
    }
  }

  return { user, secondaryDb };
};
