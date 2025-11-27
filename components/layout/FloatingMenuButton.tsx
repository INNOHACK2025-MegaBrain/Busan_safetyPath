"use client";

import { Menu } from "lucide-react";
import { useUIStore } from "@/store/uiStore";

export default function FloatingMenuButton() {
  const { openModal } = useUIStore();

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={() => openModal("menu")}
        className="h-14 w-14 rounded-full bg-background/80 backdrop-blur-md border border-border/50 text-foreground shadow-lg hover:bg-background/90 hover:scale-110 hover:shadow-xl transition-all duration-300 flex items-center justify-center"
        aria-label="메뉴"
      >
        <Menu className="h-6 w-6" />
      </button>
    </div>
  );
}

