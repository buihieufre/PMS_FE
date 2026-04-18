importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Must match your client config exactly
firebase.initializeApp({
  apiKey: "AIzaSyDKdFlXpNssp9zr4FfnE8ueVg7wV_tOmLI",
  authDomain: "hoidapcntt-af8d9.firebaseapp.com",
  projectId: "hoidapcntt-af8d9",
  storageBucket: "hoidapcntt-af8d9.firebasestorage.app",
  messagingSenderId: "186452971198",
  appId: "1:186452971198:web:1c7c145fe04e84b48a58ef",
  measurementId: "G-ECYDSCQQ03"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/favicon.ico', // Update to your app's push icon
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    if (event.notification.data && event.notification.data.url) {
        event.waitUntil(
            clients.openWindow(event.notification.data.url)
        );
    }
});
