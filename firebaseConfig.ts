import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// REPLACE WITH YOUR ACTUAL FIREBASE KEYS
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "iiid-auction.firebaseapp.com",
  databaseURL: "https://iiid-auction-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId: "iiid-auction",
  storageBucket: "iiid-auction.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
