"use client";
import BasicMap from "@/components/common/KakaoMap";
import Header from "@/components/layout/header";
import Menu from "@/components/layout/menu";
import FloatingMenuButton from "@/components/layout/FloatingMenuButton";
import FloatingReportButton from "@/components/layout/FloatingReportButton";
import SearchSheet from "@/components/layout/SearchSheet";
import RouteSheet from "@/components/layout/RouteSheet";
import ReportSheet from "@/components/layout/ReportSheet";

export type Screen = "home" | "riskMap" | "sos" | "mypage";

export default function Home() {
  return (
    <div className="w-full h-screen flex flex-col">
      <Header />
      <Menu />
      <SearchSheet />
      <RouteSheet />
      <ReportSheet />
      <FloatingMenuButton />
      <FloatingReportButton />
      <main className="w-full flex-1 pt-16">
        <BasicMap />
      </main>
    </div>
  );
}
