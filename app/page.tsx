"use client";

import BasicMap from "@/components/KakaoMap";

export type Screen = "home" | "riskMap" | "sos" | "mypage";

export default function Home() {
  return (
    <div className="w-full h-screen">
      <main className="w-full h-full">
        <BasicMap />
      </main>
    </div>
  );
}
