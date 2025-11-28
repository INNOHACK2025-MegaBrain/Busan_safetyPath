"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import { useMapStore } from "@/store/mapStore";
import { MapPin, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import useKakaoLoader from "@/hooks/useKakaoLoader";

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
      // mapStore에서 weights 가져오기
      const { weights } = useMapStore.getState();

      // GraphHopper API를 사용한 경로 계산
      const response = await fetch("/api/get-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: {
            lat: currentPosition.lat,
            lng: currentPosition.lng,
          },
          end: {
            lat: destinationInfo.coord.lat,
            lng: destinationInfo.coord.lng,
          },
          weights, // weights 전달
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("경로 계산 API 오류:", response.status, errorData);

        // 거리 제한 초과 에러 처리
        if (
          errorData.error === "거리 제한 초과" ||
          errorData.message?.includes("너무 먼 거리")
        ) {
          alert("너무 먼 거리의 경로를 선택하셨습니다.");
        } else {
          alert("경로를 찾을 수 없습니다. 다른 경로를 시도해주세요.");
        }
        setIsCalculating(false);
        return;
      }

      const data = await response.json();
      console.log("경로 계산 응답:", data);

      // 에러 응답 확인
      if (data.error) {
        console.error("경로 계산 에러:", data);

        // 거리 제한 초과 에러 처리
        if (
          data.error === "거리 제한 초과" ||
          data.message?.includes("너무 먼 거리")
        ) {
          alert("너무 먼 거리의 경로를 선택하셨습니다.");
        } else {
          alert(
            `${data.error}\n${
              data.message || ""
            }\n\n지하철역의 경우 지상 출입구 좌표를 사용해주세요.`
          );
        }
        setIsCalculating(false);
        return;
      }

      // GraphHopper 응답 구조: data.paths[0].points.coordinates
      if (data.paths && data.paths[0] && data.paths[0].points) {
        const rawPoints = data.paths[0].points.coordinates;

        // GraphHopper는 [lng, lat] 형식이므로 [lat, lng]로 변환
        const path = rawPoints.map((point: [number, number]) => ({
          lat: point[1],
          lng: point[0],
        }));

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
        console.error("경로를 찾을 수 없습니다:", data);
        const errorMsg =
          data.message ||
          "GraphHopper가 해당 지역의 경로를 찾을 수 없습니다.\n지하철역의 경우 지상 출입구 좌표를 사용해주세요.";
        alert(errorMsg);
      }

      setIsCalculating(false);
    } catch (error) {
      console.error("경로 계산 중 오류 발생:", error);
      alert("경로 계산 중 오류가 발생했습니다.");
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
