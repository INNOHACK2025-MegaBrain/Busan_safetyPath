import { initializeApp } from "firebase/app";
import { getMessaging, getToken } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBqwUEewOnrK--pbeTJSM6vkZZbj4xjZU4",
  authDomain: "fcm-test-ec0e2.firebaseapp.com",
  projectId: "fcm-test-ec0e2",
  storageBucket: "fcm-test-ec0e2.firebasestorage.app",
  messagingSenderId: "772986129078",
  appId: "1:772986129078:web:f68783c707e8b0dc7ff417",
  measurementId: "G-8N9XPXK531",
};

const app = initializeApp(firebaseConfig);
const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

export const requestNotificationPermission = async () => {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
      // VAPID Key는 Firebase 콘솔 > 클라우드 메시징 > 웹 구성에서 확인
      const token = await getToken(messaging, {
        vapidKey:
          "BH0CwbkB257GNC4RAeKBaa0h-kiyNfeZGsNV78Svg7EzQ8FLMLMjFt9IivbWpwAA28zUzOV092TMUcpp5eHIIZQ",
      });
      console.log("FCM Token:", token);

      // TODO: 이 토큰을 서버(DB)에 보내서 현재 로그인한 유저(보호자) 정보와 함께 저장해야 합니다.
      // await saveTokenToServer(token);
      return token;
    }
  } catch (error) {
    console.error("알림 권한 요청 실패:", error);
  }
};
