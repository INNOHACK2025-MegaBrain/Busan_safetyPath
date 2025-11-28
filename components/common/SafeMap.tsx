"use client";

import { Map, Polyline, MapMarker } from "react-kakao-maps-sdk";
import { useState, useEffect, useMemo } from "react";
import useKakaoLoader from "@/hooks/useKakaoLoader";
import { useMapStore } from "@/store/mapStore";

export default function SafeMap() {
  useKakaoLoader();
  const { currentPosition, destinationInfo, routePath, weights } =
    useMapStore();

  // 출발지와 도착지 설정
  const startPoint = useMemo(
    () => currentPosition || { lat: 37.5665, lng: 126.978 },
    [currentPosition]
  ); // 기본값: 서울시청
  const endPoint = useMemo(
    () => destinationInfo?.coord || { lat: 37.4979, lng: 127.0276 },
    [destinationInfo]
  ); // 기본값: 강남역

  const [localRoutePath, setLocalRoutePath] = useState<
    Array<{ lat: number; lng: number }>
  >([]);

  // routePath가 있으면 사용, 없으면 API에서 가져오기
  useEffect(() => {
    if (routePath && routePath.length > 0) {
      return;
    }

    // routePath가 없고 출발지/도착지가 모두 있으면 경로 요청
    if (startPoint && endPoint && currentPosition && destinationInfo) {
      async function fetchRoute() {
        try {
          const response = await fetch("/api/get-route", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              start: startPoint,
              end: endPoint,
              weights,
            }),
          });

          const data = await response.json();

          // GraphHopper는 [lng, lat]으로 주니까 [lat, lng]으로 뒤집어야 함
          if (data.paths && data.paths[0] && data.paths[0].points) {
            const rawPoints = data.paths[0].points.coordinates;

            const kakaoFormat = rawPoints.map((point: [number, number]) => ({
              lat: point[1],
              lng: point[0],
            }));

            setLocalRoutePath(kakaoFormat);
          }
        } catch (err) {
          console.error("경로 요청 실패:", err);
        }
      }

      fetchRoute();
    }
  }, [
    routePath,
    startPoint,
    endPoint,
    currentPosition,
    destinationInfo,
    weights,
  ]);

  return (
    <Map
      center={startPoint}
      style={{ width: "100%", height: "500px" }}
      level={7}
    >
      {/* 출발지/도착지 마커 */}
      {startPoint && <MapMarker position={startPoint} title="출발지" />}
      {endPoint && <MapMarker position={endPoint} title="도착지" />}

      {/* 안심 경로 그리기 (초록색 선) */}
      {(routePath && routePath.length > 0 ? routePath : localRoutePath).length >
        0 && (
        <Polyline
          path={routePath && routePath.length > 0 ? routePath : localRoutePath}
          strokeWeight={6}
          strokeColor={"#00FF00"}
          strokeOpacity={0.8}
          strokeStyle={"solid"}
        />
      )}
    </Map>
  );
}
