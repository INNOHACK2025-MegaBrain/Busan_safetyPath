"use client";

import { useUserStore } from "@/store/userStore";
import { useUIStore } from "@/store/uiStore";

/**
 * 보호된 기능에 사용하는 훅
 * 로그인이 안되어 있으면 로그인 모달을 열고, 로그인되어 있으면 콜백 실행
 */
export function useRequireAuth(callback: () => void) {
  const { user, isLoading } = useUserStore();
  const { openModal } = useUIStore();

  return () => {
    // 로딩 중이면 아무것도 하지 않음 (초기 로딩 대기)
    if (isLoading) {
      return;
    }

    // 로그인 안되어 있으면 로그인 모달 열기
    if (!user) {
      openModal("auth");
    } else {
      // 로그인되어 있으면 바로 콜백 실행
      // 세션 검증은 app/page.tsx에서 주기적으로 처리하므로 여기서는 불필요
      callback();
    }
  };
}
