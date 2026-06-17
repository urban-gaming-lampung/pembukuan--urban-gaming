import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Firebase Storage
export const storage = getStorage(app);

// Initialize secondary Firebase App for List Game
const secondaryAppConfig = {
  apiKey: "AIzaSyAg9QqF_F-9i2N1BgyMafy-khPBuCpv17A",
  authDomain: "list-game-digital.firebaseapp.com",
  projectId: "list-game-digital",
  storageBucket: "list-game-digital.firebasestorage.app",
  messagingSenderId: "1067180459701",
  appId: "1:1067180459701:web:dadc64e151fcb943b0a0fc",
};

const secondaryApp = getApps().find(a => a.name === 'listGameApp') || initializeApp(secondaryAppConfig, 'listGameApp');
export const listGameDb = getFirestore(secondaryApp);
