"use client";

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import { useMapStore } from "@/store/mapStore";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import useKakaoLoader from "@/hooks/useKakaoLoader";

interface RouteResult {
  routes: Array<{
    sections: Array<{
      roads: Array<{
        vertexes: number[];
      }>;
    }>;
  }>;
}

export default function RouteSheet() {
  useKakaoLoader();
  const { isModalOpen, modalType, closeModal } = useUIStore();
  const { destinationInfo, currentPosition, setRoutePath } = useMapStore();
  const [isCalculating, setIsCalculating] = useState(false);

  const isRouteOpen = isModalOpen && modalType === "route";

  const handleFindRoute = async () => {
    if (!destinationInfo || !currentPosition) {
      return;
    }

    setIsCalculating(true);

    try {
      // 카카오맵 Directions API를 사용한 경로 계산
      // 타입 정의가 없어서 타입 단언 사용
      const Directions = (
        kakao.maps.services as unknown as {
          Directions: new () => {
            route: (
              options: {
                origin: kakao.maps.LatLng;
                destination: kakao.maps.LatLng;
                priority?: number;
              },
              callback: (result: RouteResult, status: number) => void
            ) => void;
          };
        }
      ).Directions;

      const directions = new Directions();
      const start = new kakao.maps.LatLng(
        currentPosition.lat,
        currentPosition.lng
      );
      const end = new kakao.maps.LatLng(
        destinationInfo.coord.lat,
        destinationInfo.coord.lng
      );

      directions.route(
        {
          origin: start,
          destination: end,
          priority: 1, // OPTIMAL = 1
        },
        (result: RouteResult, status: number) => {
          setIsCalculating(false);

          // Status.OK는 일반적으로 0입니다
          const StatusOK = (
            kakao.maps.services.Status as unknown as { OK: number }
          ).OK;
          if (status === 0 || status === StatusOK) {
            // 경로 정보 추출
            const route = result.routes[0];
            const path: Array<{ lat: number; lng: number }> = [];

            route.sections.forEach((section) => {
              section.roads.forEach((road) => {
                const vertexes = road.vertexes;
                // vertexes는 [lng, lat, lng, lat, ...] 형식
                for (let i = 0; i < vertexes.length; i += 2) {
                  if (i + 1 < vertexes.length) {
                    path.push({
                      lng: vertexes[i], // x (lng)
                      lat: vertexes[i + 1], // y (lat)
                    });
                  }
                }
              });
            });

            // 경로를 mapStore에 저장
            setRoutePath(path);

            // Sheet 닫기
            closeModal();
          } else {
            console.error("경로 계산 실패:", status);
          }
        }
      );
    } catch (error) {
      console.error("경로 계산 중 오류 발생:", error);
      setIsCalculating(false);
    }
  };

  if (!destinationInfo) {
    return null;
  }

  return (
    <Sheet open={isRouteOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent side="bottom" className="h-auto max-h-[30vh] pb-safe">
        <div className="flex items-center gap-3 px-1 py-3">
          {/* 목적지 정보 (간소화) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">
                {destinationInfo.place_name}
              </p>
            </div>
          </div>

          {/* 안심길 우선 길찾기 버튼 */}
          <Button
            onClick={handleFindRoute}
            disabled={isCalculating || !currentPosition}
            className="h-10 px-4 text-sm font-semibold shrink-0"
            size="default"
          >
            {isCalculating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                계산 중
              </>
            ) : (
              "안심길 길찾기"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
