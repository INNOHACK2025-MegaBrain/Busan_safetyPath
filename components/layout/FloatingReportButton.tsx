"use client";

import { AlertTriangle } from "lucide-react";
import { useUIStore } from "@/store/uiStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";

export default function FloatingReportButton() {
  const { openModal } = useUIStore();
  const handleReport = useRequireAuth(() => openModal("report"));

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <button
        onClick={handleReport}
        onContextMenu={(e) => e.preventDefault()} // 우클릭 방지
        className="relative h-14 w-14 rounded-full bg-destructive hover:bg-destructive/90 border-2 border-destructive shadow-lg hover:scale-110 hover:shadow-2xl transition-all duration-300 flex items-center justify-center group ring-2 ring-destructive/20 hover:ring-destructive/40"
        aria-label="신고"
      >
        {/* 펄스 효과 */}
        <div className="absolute inset-0 rounded-full bg-destructive/30 " />
        <AlertTriangle className="h-6 w-6 text-yellow-200 group-hover:scale-110 transition-transform relative z-10" />
      </button>
    </div>
  );
}
