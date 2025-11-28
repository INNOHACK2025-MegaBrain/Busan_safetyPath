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
import { toast } from "sonner";

const HOLD_DURATION = 3000; // 3초

export default function ReportSheet() {
  const { isModalOpen, modalType, closeModal } = useUIStore();
  const [isHolding, setIsHolding] = useState(false);
  const [remainingTime, setRemainingTime] = useState(3.0);
  const [shouldShowToast, setShouldShowToast] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);

  const isReportOpen = isModalOpen && modalType === "report";

  const handleMouseDown = () => {
    setIsHolding(true);
    setRemainingTime(3.0);

    // 카운트다운 시작 (0.1초마다 업데이트)
    let timeLeft = HOLD_DURATION;
    countdownRef.current = setInterval(() => {
      timeLeft -= 100;
      const seconds = (timeLeft / 1000).toFixed(1);
      setRemainingTime(parseFloat(seconds));

      if (timeLeft <= 0) {
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }
    }, 100);

    // 3초 타이머 시작
    timerRef.current = setTimeout(() => {
      handleReportComplete();
    }, HOLD_DURATION);
  };

  const handleMouseUp = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    setIsHolding(false);
    setRemainingTime(3.0);
  };

  const handleReportComplete = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // 신고 처리 로직
    console.log("신고 완료 - 보호자에게 연락 또는 신고");

    setIsHolding(false);
    setRemainingTime(3.0);
    setShouldShowToast(true); // toast 표시 플래그 설정
    closeModal(); // 모달 닫기
  };

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // 모달이 닫힐 때 초기화 및 toast 표시
  useEffect(() => {
    if (!isReportOpen) {
      queueMicrotask(() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setIsHolding(false);
        setRemainingTime(3.0);

        // 모달이 닫힌 후 toast 표시
        if (shouldShowToast) {
          toast.success("신고가 접수되었습니다", {
            description: "보호자에게 연락이 갑니다.",
            duration: 3000,
          });
          setShouldShowToast(false); // 플래그 초기화
        }
      });
    }
  }, [isReportOpen, shouldShowToast]);

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
          {/* 큰 빨간 신고 버튼 */}
          <div className="flex flex-col items-center justify-center">
            {/* 남은 시간 표시 (버튼 상단) - 고정된 공간 할당 */}
            <div className="h-12 w-32 flex items-center justify-center mb-2">
              {isHolding && (
                <p className="text-2xl font-bold text-foreground">
                  {remainingTime.toFixed(1)}초
                </p>
              )}
            </div>

            {/* 버튼 컨테이너 - 고정된 크기 */}
            <div className="h-32 w-32 flex items-center justify-center">
              <Button
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleMouseDown}
                onTouchEnd={handleMouseUp}
                className={`
                  h-32 w-32 rounded-full bg-destructive hover:bg-destructive/90 
                  border-4 border-destructive shadow-2xl 
                  transition-colors duration-200
                  ${isHolding ? "bg-destructive/90 shadow-destructive/50" : ""}
                  flex flex-col items-center justify-center gap-2
                  relative
                `}
                aria-label="신고 버튼 - 3초간 누르세요"
              >
                <AlertTriangle className="h-12 w-12 text-destructive-foreground" />
                <span className="text-destructive-foreground font-bold text-sm">
                  {isHolding ? "계속 누르세요" : "누르고 있기"}
                </span>
              </Button>
            </div>
          </div>

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
