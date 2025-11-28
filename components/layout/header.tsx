"use client";

import { Search } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Button } from "../ui/button";

export default function Header() {
  const { openModal } = useUIStore();
  const handleSearch = useRequireAuth(() => openModal("search"));

  return (
    <header className="fixed top-0 left-0 right-0 z-[110] bg-background/80 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        {/* 로고 및 앱 이름 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg text-primary-foreground overflow-hidden">
            <img
              src="/logo.png"
              alt="logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-semibold text-foreground">MegaBrain</h1>
            <p className="text-xs text-muted-foreground">안전한 경로 찾기</p>
          </div>
        </div>

        {/* 검색 버튼 */}
        <div className="flex items-center gap-2">
          <Button
            onClick={handleSearch}
            className="p-2 rounded-lg hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
            variant="outline"
            size="icon"
            aria-label="목적지 검색"
          >
            <Search className="h-5 w-5 text-foreground" />
          </Button>
        </div>
      </div>
    </header>
  );
}
