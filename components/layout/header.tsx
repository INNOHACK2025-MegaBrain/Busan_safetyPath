"use client";

import { Menu, MapPin } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { Button } from "../ui/button";

export default function Header() {
  const { openModal } = useUIStore();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto h-16 flex items-center justify-between">
        {/* 로고 및 앱 이름 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-foreground">MegaBrain</h1>
            <p className="text-xs text-muted-foreground">안전한 경로 찾기</p>
          </div>
        </div>

        {/* 우측 메뉴 */}
        <div className="flex items-center gap-2">
          <Button
            onClick={() => openModal("menu")}
            className="p-2 rounded-lg hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
            variant="outline"
            size="icon"
            aria-label="메뉴"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </Button>
        </div>
      </div>
    </header>
  );
}
