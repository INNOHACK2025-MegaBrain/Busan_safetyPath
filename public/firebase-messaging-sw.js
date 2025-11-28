importScripts(
  "https://www.gstatic.com/firebasejs/9.x.x/firebase-app-compat.js"
);
importScripts(
  "https://www.gstatic.com/firebasejs/9.x.x/firebase-messaging-compat.js"
);

// Firebase 설정 (Firebase 콘솔에서 가져온 값)
const firebaseConfig = {
  apiKey: "AIzaSyBqwUEewOnrK--pbeTJSM6vkZZbj4xjZU4",
  authDomain: "fcm-test-ec0e2.firebaseapp.com",
  projectId: "fcm-test-ec0e2",
  storageBucket: "fcm-test-ec0e2.firebasestorage.app",
  messagingSenderId: "772986129078",
  appId: "1:772986129078:web:f68783c707e8b0dc7ff417",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// 백그라운드 알림 핸들링
messaging.onBackgroundMessage((payload) => {
  console.log("백그라운드 메시지 수신:", payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: "/icons/icon-192x192.png", // PWA 아이콘 경로
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  const title = data.notification?.title ?? "알림";
  const body = data.notification?.body ?? "";
  event.waitUntil(self.registration.showNotification(title, { body, data }));
});
