import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAnalytics, isSupported, Analytics } from 'firebase/analytics';
import { getFirestore, Firestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC1VyVDJwacN6jfsBXzAmkPD_qSql3YTo4",
  authDomain: "universe-52b3b.firebaseapp.com",
  projectId: "universe-52b3b",
  storageBucket: "universe-52b3b.firebasestorage.app",
  messagingSenderId: "448711560736",
  appId: "1:448711560736:web:7ae3dfef51bd876f44b645",
  measurementId: "G-8WPNJJ6KCG"
};

let app: FirebaseApp | null = null;
let analytics: Analytics | null = null;
let db: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (getApps().length === 0) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
  }
  return app;
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (Platform.OS === 'web') {
    const supported = await isSupported();
    if (supported && !analytics) {
      analytics = getAnalytics(getFirebaseApp());
    }
  }
  return analytics;
}

export function getFirebaseFirestore(): Firestore {
  if (!db) {
    db = getFirestore(getFirebaseApp());
  }
  return db;
}

export { firebaseConfig };
