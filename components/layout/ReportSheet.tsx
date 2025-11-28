"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
import { useMapStore } from "@/store/mapStore";
import { supabase } from "@/lib/supabase";

const HOLD_DURATION = 3000; // 3초

export default function ReportSheet() {
  const { isModalOpen, modalType, closeModal } = useUIStore();
  const [isHolding, setIsHolding] = useState(false);
  const [remainingTime, setRemainingTime] = useState(3.0);
  const [shouldShowToast, setShouldShowToast] = useState(false);
  const [isSendingSOS, setIsSendingSOS] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { currentPosition, setCurrentPosition } = useMapStore();

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

  const resolveCurrentCoords = useCallback(async () => {
    if (currentPosition) {
      return { ...currentPosition };
    }

    if (typeof window === "undefined" || !navigator.geolocation) {
      throw new Error("위치 서비스를 사용할 수 없습니다.");
    }

    return await new Promise<{ lat: number; lng: number; accuracy?: number }>(
      (resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const coords = {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
              accuracy: position.coords.accuracy,
            };
            setCurrentPosition({ lat: coords.lat, lng: coords.lng });
            resolve(coords);
          },
          (error) => {
            reject(error);
          },
          { enableHighAccuracy: true, timeout: 10_000 }
        );
      }
    );
  }, [currentPosition, setCurrentPosition]);

  const triggerSOS = useCallback(async () => {
    if (isSendingSOS) return false;
    setIsSendingSOS(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        toast.error("로그인이 필요합니다.");
        return false;
      }

      const coords = await resolveCurrentCoords();
      const response = await fetch("/api/guardians/sos", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy ?? null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const message = data.error || "SOS 전송에 실패했습니다.";
        toast.error(message);
        return false;
      }

      // 보호자에게 푸시 알림 전송
      const notifyResponse = await fetch("/api/sos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id }),
      });

      if (!notifyResponse.ok) {
        const notifyData = await notifyResponse.json().catch(() => ({}));
        console.error("SOS 알림 전송 실패", notifyData);
      }

      return true;
    } catch (error) {
      if (error instanceof GeolocationPositionError) {
        toast.error("위치 정보를 가져오지 못했습니다. 설정을 확인해주세요.");
      } else if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("예상치 못한 오류가 발생했습니다.");
      }
      return false;
    } finally {
      setIsSendingSOS(false);
    }
  }, [isSendingSOS, resolveCurrentCoords]);

  const handleReportComplete = async () => {
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
    const sosSent = await triggerSOS();
    setShouldShowToast(sosSent);
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
          toast.success("SOS가 전송되었습니다", {
            description: "연결된 보호자에게 일시적으로 위치가 공유됩니다.",
            duration: 3500,
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
                onContextMenu={(e) => e.preventDefault()} // 우클릭 방지
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
