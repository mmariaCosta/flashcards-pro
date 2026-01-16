// ===== FIREBASE CONFIGURATION =====
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD1A2k13tEZtKJdmRE3o0MXEvCULFHSUcs",
  authDomain: "flashcards-28a9e.firebaseapp.com",
  projectId: "flashcards-28a9e",
  storageBucket: "flashcards-28a9e.firebasestorage.app",
  messagingSenderId: "93390501016",
  appId: "1:93390501016:web:b4caddacc434ce68074ced",
  measurementId: "G-19DT142R85"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

console.log('✅ Firebase inicializado com sucesso');