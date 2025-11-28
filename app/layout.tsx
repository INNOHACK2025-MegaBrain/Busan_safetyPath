import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import GoogleAnalytics from "@/components/common/GoogleAnalytics";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "안심 귀갓길",
  description: "가장 안전한 경로를 안내합니다.",
  manifest: "/manifest.json", // [핵심] 여기에 연결!
  themeColor: "#22C55E", // [핵심] 안드로이드 상태바 색상
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1, // 모바일에서 지도 확대/축소 시 실수로 화면 전체가 커지는 것 방지
    userScalable: false,
  },
  // iOS용 설정 (아이폰 홈 화면 추가 시 필요)
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "안심귀가",
  },
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <GoogleAnalytics />
        {children}
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
