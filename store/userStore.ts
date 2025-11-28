import { create } from "zustand";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

interface UserStore {
  user: User | null;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  signOut: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  user: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  setLoading: (loading) => set({ isLoading: loading }),

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null });
  },

  checkAuth: async () => {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      // 에러가 발생하거나 유저가 없으면 로그아웃 처리
      if (error || !user) {
        console.log("인증 실패 또는 유저 없음:", error?.message);
        await supabase.auth.signOut();
        set({ user: null, isLoading: false });
        return;
      }

      set({ user, isLoading: false });
    } catch (error) {
      console.error("인증 확인 실패:", error);
      // 에러 발생 시 세션 정리
      await supabase.auth.signOut();
      set({ user: null, isLoading: false });
    }
  },
}));
