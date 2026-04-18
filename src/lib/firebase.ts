import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyDKdFlXpNssp9zr4FfnE8ueVg7wV_tOmLI",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "hoidapcntt-af8d9.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "hoidapcntt-af8d9",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "hoidapcntt-af8d9.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "186452971198",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:186452971198:web:1c7c145fe04e84b48a58ef",
  measurementId: "G-ECYDSCQQ03"
};

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Messaging setup
// We only initialize messaging on the client side, and after verifying browser support
let messaging: any = null;

export const initMessaging = async () => {
    if (typeof window !== "undefined") {
      const supported = await isSupported();
      if (supported) {
        messaging = getMessaging(app);
      }
    }
    return messaging;
};

export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const msg = await initMessaging();
      if (!msg) return null;

      const currentToken = await getToken(msg, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "BGyCk-C-EZoxC5CgEOd6UXRKSNSt_P9D3iXWBXyyNgseegr-K3EubivtuLNTftXC3UT-IwTp8B1zCBGEIKUQYPQ"
      });

      if (currentToken) {
        return currentToken;
      } else {
        console.warn('No registration token available. Request permission to generate one.');
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('An error occurred while retrieving token. ', error);
    return null;
  }
};

export { app, messaging, onMessage };
