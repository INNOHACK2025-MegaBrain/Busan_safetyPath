"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import { useMapStore } from "@/store/mapStore";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import useKakaoLoader from "@/hooks/useKakaoLoader";

interface KakaoServices {
  Directions?: new () => {
    route: (
      options: {
        origin: kakao.maps.LatLng;
        destination: kakao.maps.LatLng;
        priority?: number;
      },
      callback: (result: RouteData, status: number) => void
    ) => void;
  };
  Status?: {
    OK: number;
  };
}

interface RouteSection {
  roads: Array<{
    vertexes: number[];
  }>;
}

interface RouteData {
  routes: Array<{
    sections: RouteSection[];
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
      console.error("목적지 또는 현재 위치가 없습니다");
      return;
    }

    setIsCalculating(true);

    try {
      // 카카오맵 Directions API 확인
      const services = kakao.maps.services as unknown as KakaoServices;
      if (!services || !services.Directions) {
        console.error(
          "Directions API를 사용할 수 없습니다. REST API를 사용합니다."
        );

        // REST API를 사용한 경로 계산
        const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
        if (!apiKey) {
          console.error("카카오맵 API 키가 없습니다");
          setIsCalculating(false);
          return;
        }

        const url = `https://apis-navi.kakao.com/v1/directions?origin=${currentPosition.lng},${currentPosition.lat}&destination=${destinationInfo.coord.lng},${destinationInfo.coord.lat}&waypoints=&priority=RECOMMEND&car_fuel=GASOLINE&car_hipass=false&alternatives=false&road_details=false`;

        const response = await fetch(url, {
          headers: {
            Authorization: `KakaoAK ${apiKey}`,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const path: Array<{ lat: number; lng: number }> = [];

          // 경로 추출
          route.sections?.forEach((section: RouteSection) => {
            section.roads?.forEach((road) => {
              if (road.vertexes) {
                const vertexes = road.vertexes;
                // vertexes는 [lng, lat, lng, lat, ...] 형식
                for (let i = 0; i < vertexes.length; i += 2) {
                  if (i + 1 < vertexes.length) {
                    path.push({
                      lng: vertexes[i],
                      lat: vertexes[i + 1],
                    });
                  }
                }
              }
            });
          });

          console.log("경로 계산 완료:", path.length, "개 포인트");
          setRoutePath(path);
          closeModal();
        } else {
          console.error("경로를 찾을 수 없습니다");
        }

        setIsCalculating(false);
        return;
      }

      // SDK Directions API 사용 시도
      const Directions = services.Directions;
      if (!Directions) {
        throw new Error("Directions API를 사용할 수 없습니다");
      }

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
        (result: RouteData, status: number) => {
          setIsCalculating(false);
          console.log("Directions API 응답:", { result, status });

          // Status 확인
          const StatusOK = services.Status?.OK ?? 0;
          if (status === 0 || status === StatusOK) {
            // 경로 정보 추출
            if (!result?.routes || result.routes.length === 0) {
              console.error("경로 데이터가 없습니다");
              return;
            }

            const route = result.routes[0];
            const path: Array<{ lat: number; lng: number }> = [];

            route.sections?.forEach((section: RouteSection) => {
              section.roads?.forEach((road) => {
                if (road.vertexes) {
                  const vertexes = road.vertexes;
                  // vertexes는 [lng, lat, lng, lat, ...] 형식
                  for (let i = 0; i < vertexes.length; i += 2) {
                    if (i + 1 < vertexes.length) {
                      path.push({
                        lng: vertexes[i],
                        lat: vertexes[i + 1],
                      });
                    }
                  }
                }
              });
            });

            console.log("경로 계산 완료:", path.length, "개 포인트");
            setRoutePath(path);
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
        <SheetTitle className="sr-only">목적지 길찾기</SheetTitle>
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
