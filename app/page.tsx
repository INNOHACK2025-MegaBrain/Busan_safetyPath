"use client";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import Header from "@/components/layout/header";
import Menu from "@/components/layout/menu";
import FloatingMenuButton from "@/components/layout/FloatingMenuButton";
import FloatingReportButton from "@/components/layout/FloatingReportButton";
import SearchSheet from "@/components/layout/SearchSheet";
import RouteSheet from "@/components/layout/RouteSheet";
import ReportSheet from "@/components/layout/ReportSheet";
import AuthModal from "@/components/auth/AuthModal";
import { useUserStore } from "@/store/userStore";
import { supabase } from "@/lib/supabase";

const BasicMap = dynamic(() => import("@/components/common/KakaoMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-gray-100 text-muted-foreground">
      지도를 불러오는 중...
    </div>
  ),
});

export type Screen = "home" | "riskMap" | "sos" | "mypage";

export default function Home() {
  const { setUser, checkAuth } = useUserStore();

  // 인증 상태 초기화 및 세션 리스너 설정
  useEffect(() => {
    // 초기 인증 상태 확인
    checkAuth();

    // Supabase 인증 상태 변경 리스너
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (
        event === "SIGNED_OUT" ||
        event === "TOKEN_REFRESHED" ||
        event === "USER_UPDATED"
      ) {
        // 세션이 없거나 유저가 없으면 로그아웃 처리
        if (!session || !session.user) {
          setUser(null);
          return;
        }

        // 유저가 실제로 존재하는지 확인
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          console.log("유저 확인 실패, 로그아웃 처리:", error?.message);
          await supabase.auth.signOut();
          setUser(null);
          return;
        }

        setUser(user);
      } else if (event === "SIGNED_IN") {
        setUser(session?.user ?? null);
      } else {
        setUser(session?.user ?? null);
      }
    });

    // 주기적으로 인증 상태 확인 (5분마다)
    const intervalId = setInterval(() => {
      checkAuth();
    }, 5 * 60 * 1000); // 5분

    // 페이지 포커스 시 인증 상태 확인
    const handleFocus = () => {
      checkAuth();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      subscription.unsubscribe();
      clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [setUser, checkAuth]);

  return (
    <div className="w-full h-screen flex flex-col">
      <Header />
      <Menu />
      <SearchSheet />
      <RouteSheet />
      <ReportSheet />
      <AuthModal />
      <FloatingMenuButton />
      <FloatingReportButton />
      <main className="w-full flex-1 pt-16">
        <BasicMap />
      </main>
    </div>
  );
}
