import { initializeApp, getApp, getApps, FirebaseApp } from "firebase/app";
// @ts-ignore
import { getAuth, initializeAuth, Auth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyCsfJkq8iPKiRMPxDUCKaQA1cpc6BCxoNo",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "greyadz-ff727.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "greyadz-ff727",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "greyadz-ff727.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "420509611534",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:420509611534:android:1f2b139e20cf4db77bee5f",
};

// Initialize Firebase
let app: FirebaseApp;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// Initialize Auth properly for React Native / Expo
let auth: Auth;
if (Platform.OS === 'web') {
  auth = getAuth(app);
} else {
  // If getReactNativePersistence is missing from exports in this version, fallback to default
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence ? getReactNativePersistence(ReactNativeAsyncStorage) : undefined,
  });
}

const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
