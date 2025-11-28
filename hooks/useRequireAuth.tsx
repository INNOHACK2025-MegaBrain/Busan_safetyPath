"use client";

import { useUserStore } from "@/store/userStore";
import { useUIStore } from "@/store/uiStore";
import { supabase } from "@/lib/supabase";

/**
 * 보호된 기능에 사용하는 훅
 * 로그인이 안되어 있으면 로그인 모달을 열고, 로그인되어 있으면 콜백 실행
 */
export function useRequireAuth(callback: () => void) {
  const { user, isLoading, checkAuth } = useUserStore();
  const { openModal } = useUIStore();

  return async () => {
    if (isLoading) {
      // 로딩 중이면 잠시 대기 후 다시 체크
      setTimeout(async () => {
        const currentUser = useUserStore.getState().user;
        if (!currentUser) {
          openModal("auth");
        } else {
          // 유저가 있더라도 실제로 유효한지 확인
          const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
          if (error || !verifiedUser) {
            await supabase.auth.signOut();
            useUserStore.getState().setUser(null);
            openModal("auth");
          } else {
            callback();
          }
        }
      }, 100);
      return;
    }

    if (!user) {
      // 로그인 안되어 있으면 로그인 모달 열기
      openModal("auth");
    } else {
      // 로그인되어 있으면 실제 유효한지 확인 후 콜백 실행
      const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
      if (error || !verifiedUser) {
        // 유저가 유효하지 않으면 로그아웃 처리
        await supabase.auth.signOut();
        useUserStore.getState().setUser(null);
        openModal("auth");
      } else {
        callback();
      }
    }
  };
}

