import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAqXZzXJCrtdg3FcGoaqt5ptOG6FN-xbnU",
  authDomain: "erp-autoparts-auth.firebaseapp.com",
  projectId: "erp-autoparts-auth",
  storageBucket: "erp-autoparts-auth.firebasestorage.app",
  messagingSenderId: "51139966576",
  appId: "1:51139966576:web:c35bd3a8919e10c87f66b5"
  // measurementId: "G-PLN24VYSGC" // Removed for simplicity since analytics are not needed right now
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
