"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

const HOLD_DURATION = 3000; // 3초

export default function ReportSheet() {
  const { isModalOpen, modalType, closeModal } = useUIStore();
  const [progress, setProgress] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const isReportOpen = isModalOpen && modalType === "report";

  const handleMouseDown = () => {
    setIsHolding(true);
    setProgress(0);
    startTimeRef.current = Date.now();

    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const newProgress = Math.min((elapsed / HOLD_DURATION) * 100, 100);
        setProgress(newProgress);

        if (newProgress >= 100) {
          handleReportComplete();
        }
      }
    }, 16); // 약 60fps
  };

  const handleMouseUp = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsHolding(false);
    setProgress(0);
    startTimeRef.current = null;
  };

  const handleMouseLeave = () => {
    handleMouseUp();
  };

  const handleReportComplete = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // 신고 처리 로직
    console.log("신고 완료 - 보호자에게 연락 또는 신고");
    alert("신고가 접수되었습니다. 보호자에게 연락이 갑니다.");

    setIsHolding(false);
    setProgress(0);
    closeModal();
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // 모달이 닫힐 때 progress 초기화
  useEffect(() => {
    if (!isReportOpen) {
      handleMouseUp();
    }
  }, [isReportOpen]);

  return (
    <Sheet open={isReportOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh]">
        <SheetHeader>
          <SheetTitle className="text-center text-2xl">
            위급한 상황이신가요?
          </SheetTitle>
          <SheetDescription className="text-center text-base mt-2">
            버튼을 3초간 꾹 눌러주시면 보호자에게 연락 또는 신고가 됩니다!
          </SheetDescription>
        </SheetHeader>

        <div className="mt-8 flex flex-col items-center gap-6 pb-6">
          {/* 큰 빨간 신고 버튼 with 원형 Progress */}
          <div className="relative flex items-center justify-center w-40 h-40">
            {/* 외부 원형 Progress 바 */}
            <svg
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 -rotate-90"
              viewBox="0 0 100 100"
            >
              {/* 배경 원 */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="currentColor"
                strokeWidth="8"
                className="text-muted/20"
              />
              {/* Progress 원 */}
              {isHolding && (
                <circle
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="8"
                  strokeLinecap="round"
                  className="text-destructive transition-all duration-75 ease-linear"
                  strokeDasharray={`${2 * Math.PI * 45}`}
                  strokeDashoffset={`${
                    2 * Math.PI * 45 * (1 - progress / 100)
                  }`}
                />
              )}
            </svg>

            {/* 신고 버튼 */}
            <Button
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
              className={`
                relative h-32 w-32 rounded-full bg-destructive hover:bg-destructive/90 
                border-4 border-destructive shadow-2xl 
                transition-all duration-200
                ${isHolding ? "scale-95 shadow-destructive/50" : "scale-100"}
                active:scale-95
                flex flex-col items-center justify-center gap-2
              `}
              aria-label="신고 버튼 - 3초간 누르세요"
            >
              <AlertTriangle className="h-12 w-12 text-destructive-foreground" />
              <span className="text-destructive-foreground font-bold text-sm">
                {isHolding ? "계속 누르세요" : "누르고 있기"}
              </span>
              {isHolding && (
                <span className="text-destructive-foreground/80 text-xs">
                  {(3 - (progress / 100) * 3).toFixed(1)}초
                </span>
              )}
            </Button>
          </div>

          {/* Progress 텍스트 */}
          {isHolding && (
            <div className="text-center">
              <p className="text-lg font-semibold text-foreground">
                {progress.toFixed(0)}% 완료
              </p>
            </div>
          )}

          {/* 취소 버튼 */}
          <Button
            onClick={closeModal}
            variant="ghost"
            className="text-muted-foreground hover:text-foreground"
          >
            취소
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
