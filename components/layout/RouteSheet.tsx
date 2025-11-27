"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import { useMapStore } from "@/store/mapStore";
import { MapPin, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import useKakaoLoader from "@/hooks/useKakaoLoader";

interface RouteRoad {
  vertexes?: number[];
  [key: string]: unknown;
}

interface RouteSection {
  roads?: RouteRoad[];
  [key: string]: unknown;
}

interface RouteData {
  sections?: RouteSection[];
  [key: string]: unknown;
}

interface RouteResponse {
  routes?: RouteData[];
  [key: string]: unknown;
}

export default function RouteSheet() {
  useKakaoLoader();
  const { isModalOpen, modalType, closeModal } = useUIStore();
  const { destinationInfo, currentPosition, setRoutePath } = useMapStore();
  const [isCalculating, setIsCalculating] = useState(false);

  const isRouteOpen = isModalOpen && modalType === "route";

  // 카카오맵 웹 길찾기 링크 생성
  const getKakaoMapRouteUrl = () => {
    if (!destinationInfo || !currentPosition) return "";

    const originName = "현재위치";
    const originCoords = `${currentPosition.lat},${currentPosition.lng}`;
    const destName = destinationInfo.place_name.replace(/,/g, "");
    const destCoords = `${destinationInfo.coord.lat},${destinationInfo.coord.lng}`;

    // 자동차 경로로 길찾기 (안심길 우선)
    return `https://map.kakao.com/link/by/walk/${originName},${originCoords}/${destName},${destCoords}`;
  };

  const handleOpenKakaoMap = () => {
    const url = getKakaoMapRouteUrl();
    if (url) {
      window.open(url, "_blank");
    }
  };

  const handleFindRoute = async () => {
    if (!destinationInfo || !currentPosition) {
      console.error("목적지 또는 현재 위치가 없습니다");
      return;
    }

    setIsCalculating(true);

    try {
      const apiKey = process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY;
      if (!apiKey) {
        console.error("카카오맵 API 키가 없습니다");
        alert("API 키가 설정되지 않았습니다.");
        setIsCalculating(false);
        return;
      }

      const { weights } = useMapStore.getState();

      // REST API를 사용한 경로 계산
      const origin = `${currentPosition.lng},${currentPosition.lat}`;
      const destination = `${destinationInfo.coord.lng},${destinationInfo.coord.lat}`;

      // 여러 경로 옵션을 가져와서 안심길 우선으로 필터링
      const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin}&destination=${destination}&waypoints=&priority=RECOMMEND&alternatives=true&road_details=true`;

      console.log("경로 계산 요청:", { origin, destination });

      const response = await fetch(url, {
        headers: {
          Authorization: `KakaoAK ${apiKey}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("경로 계산 API 오류:", response.status, errorText);
        alert("경로를 찾을 수 없습니다. 다른 경로를 시도해주세요.");
        setIsCalculating(false);
        return;
      }

      const data: RouteResponse = await response.json();
      console.log("경로 계산 응답:", data);

      if (data.routes && data.routes.length > 0) {
        // 여러 경로 중 안심길 우선 경로 선택
        const bestRoute = selectSafeRoute(data.routes, weights);

        if (!bestRoute) {
          console.error("적합한 경로를 찾을 수 없습니다");
          alert("안전한 경로를 찾을 수 없습니다.");
          setIsCalculating(false);
          return;
        }

        const path = extractPathFromRoute(bestRoute);

        if (path.length > 0) {
          console.log("경로 계산 완료:", path.length, "개 포인트");
          setRoutePath(path);

          // 지도 중심을 경로의 중간 지점으로 이동
          const midIndex = Math.floor(path.length / 2);
          if (path[midIndex]) {
            const { setCenter } = useMapStore.getState();
            setCenter({
              lat: path[midIndex].lat,
              lng: path[midIndex].lng,
            });
          }

          closeModal();
        } else {
          console.error("경로 포인트를 추출할 수 없습니다");
          alert("경로 정보를 처리할 수 없습니다.");
        }
      } else {
        console.error("경로를 찾을 수 없습니다");
        alert("경로를 찾을 수 없습니다.");
      }

      setIsCalculating(false);
    } catch (error) {
      console.error("경로 계산 중 오류 발생:", error);
      alert("경로 계산 중 오류가 발생했습니다.");
      setIsCalculating(false);
    }
  };

  // 안심길 우선 경로 선택 함수
  function selectSafeRoute(
    routes: RouteData[],
    weights: { cctv: number; crime: number; light: number; roadSafety: number }
  ): RouteData | null {
    // TODO: 실제 안심길 데이터(CCTV, 범죄율, 조명, 도로 안전도)를 기반으로
    // 각 경로를 평가하고 가장 안전한 경로를 선택하는 로직 구현

    // 현재는 첫 번째 경로를 반환하지만,
    // 향후 각 경로의 도로 정보를 분석하여 weights를 고려한 점수를 계산해야 함

    return routes[0] || null;
  }

  // 경로 좌표 추출 함수
  function extractPathFromRoute(
    route: RouteData
  ): Array<{ lat: number; lng: number }> {
    const path: Array<{ lat: number; lng: number }> = [];

    if (route.sections && route.sections.length > 0) {
      route.sections.forEach((section: RouteSection) => {
        if (section.roads && Array.isArray(section.roads)) {
          section.roads.forEach((road: RouteRoad) => {
            if (road.vertexes && Array.isArray(road.vertexes)) {
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
        }
      });
    }

    return path;
  }

  if (!destinationInfo) {
    return null;
  }

  return (
    <Sheet open={isRouteOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent side="bottom" className="h-auto max-h-[30vh] pb-safe">
        <SheetTitle className="sr-only">목적지 길찾기</SheetTitle>
        <div className="flex items-center gap-2 px-1 py-3">
          {/* 목적지 정보 (간소화) */}
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground text-sm truncate">
                {destinationInfo.place_name}
              </p>
            </div>
          </div>

          {/* 버튼 그룹 */}
          <div className="flex items-center gap-2 shrink-0">
            {/* 카카오맵 웹에서 열기 버튼 */}
            <Button
              onClick={handleOpenKakaoMap}
              variant="outline"
              size="icon"
              className="h-10 w-10"
              title="카카오맵에서 열기"
            >
              <ExternalLink className="h-4 w-4" />
            </Button>

            {/* 안심길 우선 길찾기 버튼 */}
            <Button
              onClick={handleFindRoute}
              disabled={isCalculating || !currentPosition}
              className="h-10 px-4 text-sm font-semibold"
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
