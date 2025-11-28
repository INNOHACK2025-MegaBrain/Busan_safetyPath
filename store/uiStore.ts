import { create } from "zustand";

interface UIStore {
  isModalOpen: boolean;
  modalType?: string; // 신고, 설정 등 구분 가능

  isLoading: boolean;

  toast: {
    message: string;
    type: "success" | "error" | "info" | null;
    isOpen: boolean;
  };

  openModal: (type?: string) => void;
  closeModal: () => void;

  startLoading: () => void;
  stopLoading: () => void;

  showToast: (message: string, type?: "success" | "error" | "info") => void;
  hideToast: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isModalOpen: false,
  modalType: undefined,

  isLoading: false,

  toast: {
    message: "",
    type: null,
    isOpen: false,
  },

  openModal: (type) => set({ isModalOpen: true, modalType: type }),
  closeModal: () => set({ isModalOpen: false, modalType: undefined }),

  startLoading: () => set({ isLoading: true }),
  stopLoading: () => set({ isLoading: false }),

  showToast: (message, type = "info") =>
    set({
      toast: {
        message,
        type,
        isOpen: true,
      },
    }),

  hideToast: () =>
    set({
      toast: {
        message: "",
        type: null,
        isOpen: false,
      },
    }),
}));
