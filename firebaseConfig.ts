import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// REPLACE WITH YOUR ACTUAL FIREBASE KEYS
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "auction-2026.firebaseapp.com",
  databaseURL: "https://auction-2026-default-rtdb.firebaseio.com",
  projectId: "auction-2026",
  storageBucket: "auction-2026.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
