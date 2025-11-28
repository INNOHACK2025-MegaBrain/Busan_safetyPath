"use client";

import { Map, Polyline, CustomOverlayMap } from "react-kakao-maps-sdk";
import useKakaoLoader from "@/hooks/useKakaoLoader";
import { useRef, useState, useEffect, useMemo } from "react";
import AddMapCustomControlStyle from "./addMapCustomControl.style";
import { MapMarker, MarkerClusterer } from "react-kakao-maps-sdk";
import {
  Navigation,
  MapPin,
  X,
  Map as MapIcon,
  Satellite,
  Layers,
  Grid3x3,
} from "lucide-react";
import { useMapStore } from "@/store/mapStore";
import { useUIStore } from "@/store/uiStore";
import { Toggle } from "@/components/ui/toggle";
import HeatmapLayer from "./HeatmapLayer";

export default function BasicMap() {
  useKakaoLoader();
  const mapRef = useRef<kakao.maps.Map>(null);
  const [mapType, setMapType] = useState<"roadmap" | "skyview">("roadmap");
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<
    "none" | "cluster" | "heatmap"
  >("none"); // 기본값은 none 유지

  // mapStore에서 center와 destinationInfo, routePath, currentPosition 가져오기
  const {
    center,
    setCenter,
    destinationInfo,
    routePath,
    currentPosition,
    setCurrentPosition,
    showDestinationOverlay,
    setShowDestinationOverlay,
    securityLights,
    setSecurityLights,
    safeReturnPaths,
    setSafeReturnPaths,
    emergencyBells,
    setEmergencyBells,
    setLevel,
  } = useMapStore();
  const { openModal } = useUIStore();
  const [loading, setLoading] = useState(true);
  const hasCheckedDebug = useRef(false);

  // 이전 요청 취소를 위한 AbortController (컴포넌트 최상위로 이동)
  const abortControllerRef = useRef<AbortController | null>(null);
  const pathAbortControllerRef = useRef<AbortController | null>(null); // 여성 안심 귀갓길용
  const bellAbortControllerRef = useRef<AbortController | null>(null); // 비상벨용
  // 마지막 조회 영역 저장 (중복 요청 방지)
  const lastBoundsRef = useRef<{
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  } | null>(null);

  // 1. 경로 생성: routePath가 있을 때만 경로 표시
  const path = useMemo(() => {
    // 계산된 경로가 있으면 사용
    if (routePath && routePath.length > 0) {
      return routePath;
    }

    // routePath가 없으면 경로 표시 안 함
    return [];
  }, [routePath]);

  useEffect(() => {
    // 현재 위치가 이미 있으면 로딩 완료
    if (currentPosition) {
      queueMicrotask(() => {
        setLoading(false);
      });
      return;
    }

    // 현재 위치 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentPosition(newPosition);
          setCenter(newPosition);
          setLoading(false);
        },
        (error) => {
          console.error("위치 정보를 가져올 수 없습니다:", error);
          const fallbackPosition = {
            lat: center.lat,
            lng: center.lng,
          };
          setCurrentPosition(fallbackPosition);
          setLoading(false);
        }
      );
    } else {
      console.error("Geolocation을 지원하지 않는 브라우저입니다.");
      queueMicrotask(() => {
        const fallbackPosition = {
          lat: center.lat,
          lng: center.lng,
        };
        setCurrentPosition(fallbackPosition);
        setLoading(false);
      });
    }
  }, [center, setCenter, currentPosition, setCurrentPosition]);

  // mapStore의 center가 변경될 때 지도 이동
  useEffect(() => {
    const map = mapInstance || mapRef.current;
    if (!map) return;

    const moveLatLon = new kakao.maps.LatLng(center.lat, center.lng);
    map.setCenter(moveLatLon);
  }, [center, mapInstance]); // mapInstance 의존성 추가

  // 지도 영역 변경 시 보안등 데이터 가져오기
  useEffect(() => {
    const map = mapInstance || mapRef.current;
    if (!map || loading) {
      return;
    }

    // useEffect 내부에서는 useRef를 호출하지 않고, 이미 선언된 ref 사용
    const fetchSecurityLights = async () => {
      try {
        const bounds = map.getBounds();
        if (!bounds) {
          return;
        }

        const swLatLng = bounds.getSouthWest();
        const neLatLng = bounds.getNorthEast();
        const swLat = swLatLng.getLat();
        const swLng = swLatLng.getLng();
        const neLat = neLatLng.getLat();
        const neLng = neLatLng.getLng();

        // 이전 조회 영역과 비교
        const lastBounds = lastBoundsRef.current;
        if (lastBounds) {
          const latDiff =
            Math.abs(neLat - lastBounds.neLat) +
            Math.abs(swLat - lastBounds.swLat);
          const lngDiff =
            Math.abs(neLng - lastBounds.neLng) +
            Math.abs(swLng - lastBounds.swLng);

          // 영역이 크게 변하지 않았으면 요청하지 않음 (0.01도 = 약 1km)
          if (latDiff < 0.01 && lngDiff < 0.01) {
            console.log("[지도] 영역 변경이 작아서 요청 생략");
            return;
          }
        }

        // 이전 요청이 있으면 취소
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // 새로운 AbortController 생성
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // 조회 영역 저장
        lastBoundsRef.current = { swLat, swLng, neLat, neLng };

        // 디버그 모드로 전체 데이터 확인 (첫 로드 시에만)
        if (!hasCheckedDebug.current) {
          hasCheckedDebug.current = true;
          if (process.env.NODE_ENV === "development") {
            try {
              const debugResponse = await fetch(
                `/api/security-lights?debug=true`
              );
              if (debugResponse.ok) {
                const debugData = await debugResponse.json();
                console.log("[지도] 보안등 데이터 확인:", debugData);
              }

              const debugPathResponse = await fetch(
                `/api/safe-return-paths?debug=true`
              );
              if (debugPathResponse.ok) {
                const debugPathData = await debugPathResponse.json();
                console.log("[지도] 안심 귀갓길 데이터 확인:", debugPathData);
              }

              const debugBellResponse = await fetch(
                `/api/emergency-bells?debug=true`
              );
              if (debugBellResponse.ok) {
                const debugBellData = await debugBellResponse.json();
                console.log("[지도] 비상벨 데이터 확인:", debugBellData);
              }
            } catch (debugError) {
              console.error("[지도] 디버그 API 호출 실패:", debugError);
            }
          }
        }

        const response = await fetch(
          `/api/security-lights?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`,
          { signal: abortController.signal }
        );

        // 여성 안심 귀갓길 데이터 가져오기
        if (pathAbortControllerRef.current) {
          pathAbortControllerRef.current.abort();
        }
        const pathAbortController = new AbortController();
        pathAbortControllerRef.current = pathAbortController;

        // 비상벨 데이터 가져오기
        if (bellAbortControllerRef.current) {
          bellAbortControllerRef.current.abort();
        }
        const bellAbortController = new AbortController();
        bellAbortControllerRef.current = bellAbortController;

        const pathResponse = await fetch(
          `/api/safe-return-paths?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`,
          { signal: pathAbortController.signal }
        );

        const bellResponse = await fetch(
          `/api/emergency-bells?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`,
          { signal: bellAbortController.signal }
        );

        // 요청이 취소되었으면 처리하지 않음
        if (abortController.signal.aborted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const lights = data.securityLights || [];

          if (lights.length > 0) {
            // 좌표 유효성 검사
            const validLights = lights.filter(
              (light: { latitude?: number; longitude?: number }) =>
                light.latitude &&
                light.longitude &&
                typeof light.latitude === "number" &&
                typeof light.longitude === "number" &&
                !isNaN(light.latitude) &&
                !isNaN(light.longitude)
            );
            setSecurityLights(validLights);
          } else {
            setSecurityLights([]);
          }
        }

        if (pathResponse.ok) {
          const pathData = await pathResponse.json();
          setSafeReturnPaths(pathData.paths || []);
        }

        if (bellResponse.ok) {
          const bellData = await bellResponse.json();
          setEmergencyBells(bellData.bells || []);
        }
      } catch (error) {
        // AbortError는 무시 (의도적인 취소)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("[지도] 데이터 가져오기 실패:", error);
      }
    };

    // 지도 이동 완료 시 보안등 데이터 가져오기 (idle 이벤트는 이미 debounce됨)
    const handleIdle = () => {
      fetchSecurityLights();
    };

    // 지도 로드 완료 후 이벤트 리스너 추가
    const handleLoad = () => {
      const bounds = map.getBounds();
      if (bounds) {
        kakao.maps.event.addListener(map, "idle", handleIdle);
        // 초기 로드 시 한 번 실행
        fetchSecurityLights();
      }
    };

    kakao.maps.event.addListener(map, "tilesloaded", handleLoad);

    // 지도가 이미 로드된 경우를 대비해 직접 호출 시도
    const tryFetch = () => {
      const bounds = map.getBounds();
      if (bounds) {
        fetchSecurityLights();
        // 중복 등록 방지를 위해 기존 리스너 제거 시도 후 추가는 handleLoad에서 처리하지만
        // 여기서는 바로 idle 리스너를 붙이는게 안전함
        kakao.maps.event.removeListener(map, "idle", handleIdle);
        kakao.maps.event.addListener(map, "idle", handleIdle);
      } else {
        setTimeout(tryFetch, 500);
      }
    };

    setTimeout(tryFetch, 100);

    return () => {
      // cleanup 시 진행 중인 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pathAbortControllerRef.current) {
        pathAbortControllerRef.current.abort();
      }
      if (bellAbortControllerRef.current) {
        bellAbortControllerRef.current.abort();
      }
      kakao.maps.event.removeListener(map, "tilesloaded", handleLoad);
      kakao.maps.event.removeListener(map, "idle", handleIdle);
    };
  }, [
    setSecurityLights,
    setSafeReturnPaths,
    setEmergencyBells,
    loading,
    mapInstance,
  ]);

  // 3. [마커 렌더링 헬퍼 함수] - return 문 전에 추가 (370줄 근처, if (loading) 전에)
  const renderMarkers = () => {
    const markers = [];

    // 아이콘 SVG Data URI (원형 배경 포함)
    const lightIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23EAB308%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23EAB308%22%20stroke%3D%22%23EAB308%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M15%2014c.2-1%20.7-1.7%201.5-2.5%201-1%201.5-2%201.5-3.5A6%206%200%200%200%206%208c0%201%20.5%202%201.5%203.5.8.8%201.3%201.5%201.5%202.5%22%2F%3E%3Cpath%20d%3D%22M9%2018h6%22%2F%3E%3Cpath%20d%3D%22M10%2022h4%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
    const footprintIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%233B82F6%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%233B82F6%22%20stroke%3D%22%233B82F6%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2016v-2.38C4%2011.5%202.97%2010.5%203%208c.03-2.72%201.49-6%204.5-6C9.37%202%2011%203.8%2011%208c0%201.25-.5%202-1.25%202H4.12c.34.6.54%201.28.54%202A2.5%202.5%200%200%201%204%2016z%22%2F%3E%3Cpath%20d%3D%22M20%2020v-2.38c0-2.12%201.03-3.12%201-5.62-.03-2.72-1.49-6-4.5-6C14.63%206%2013%207.8%2013%2012c0%201.25.5%202%201.25%202h5.63c-.34.6-.54%201.28-.54%202a2.5%202.5%200%200%201%20.66%204z%22%2F%3E%3Cpath%20d%3D%22M16%2017h4%22%2F%3E%3Cpath%20d%3D%22M4%2013h4%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E";
    const bellIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23EF4444%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23EF4444%22%20stroke%3D%22%23EF4444%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%208a6%206%200%200%201%2012%200c0%207%203%209%203%209H3s3-2%203-9%22%2F%3E%3Cpath%20d%3D%22M10.3%2021a1.94%201.94%200%200%200%203.4%200%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E";

    // 보안등 마커
    if (securityLights && securityLights.length > 0) {
      const lightMarkers = securityLights
        .filter((light) => {
          // 좌표 유효성 검사
          return (
            light.latitude &&
            light.longitude &&
            typeof light.latitude === "number" &&
            typeof light.longitude === "number" &&
            !isNaN(light.latitude) &&
            !isNaN(light.longitude)
          );
        })
        .map((light) => {
          const title =
            light.address_lot ||
            `${light.si_do || ""} ${light.si_gun_gu || ""} ${
              light.eup_myeon_dong || ""
            }`.trim() ||
            "보안등";

          return (
            <MapMarker
              key={`light-${light.id}`}
              position={{ lat: light.latitude, lng: light.longitude }}
              title={title || ""}
              image={{
                src: lightIcon,
                size: { width: 32, height: 32 },
              }}
            />
          );
        });
      markers.push(...lightMarkers);
    }

    // 안심 귀갓길 마커 (파란색) - 줌 레벨 5 이하일 때만 표시 (더 확대되었을 때)
    // 카카오맵은 레벨이 낮을수록 확대된 상태임 (1: 가장 확대 ~ 14: 가장 축소)
    if (
      safeReturnPaths &&
      safeReturnPaths.length > 0 &&
      mapInstance &&
      mapInstance.getLevel() <= 5
    ) {
      const pathMarkers = safeReturnPaths.map((path) => (
        <MapMarker
          key={`path-${path.id}`}
          position={{ lat: path.start_latitude, lng: path.start_longitude }}
          title={`안심 귀갓길: ${path.start_address} ~ ${path.end_address}`}
          image={{
            src: footprintIcon,
            size: { width: 32, height: 32 },
          }}
        />
      ));
      markers.push(...pathMarkers);
    }

    // 비상벨 마커 (빨간색) - 줌 레벨 5 이하일 때만 표시
    if (
      emergencyBells &&
      emergencyBells.length > 0 &&
      mapInstance &&
      mapInstance.getLevel() <= 5
    ) {
      const bellMarkers = emergencyBells.map((bell) => (
        <MapMarker
          key={`bell-${bell.id}`}
          position={{ lat: bell.latitude, lng: bell.longitude }}
          title={`비상벨: ${bell.location || bell.category}`}
          image={{
            src: bellIcon,
            size: { width: 32, height: 32 },
          }}
        />
      ));
      markers.push(...bellMarkers);
    }

    return markers;
  };

  if (loading) {
    return (
      <div className="w-full h-[350px] flex items-center justify-center bg-gray-100">
        <p>위치 정보를 가져오는 중...</p>
      </div>
    );
  }
  return (
    <>
      <AddMapCustomControlStyle />
      <div className={`map_wrap`}>
        <Map
          id="map"
          center={{
            lat: center.lat,
            lng: center.lng,
          }}
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            overflow: "hidden",
          }}
          level={3}
          mapTypeId={mapType === "roadmap" ? "ROADMAP" : "HYBRID"}
          ref={mapRef}
          onCreate={(map) => {
            console.log("[지도] onCreate 콜백 호출됨, 지도 인스턴스 받음");
            setMapInstance(map);
          }}
          onZoomChanged={(map) => {
            setCenter({
              lat: map.getCenter().getLat(),
              lng: map.getCenter().getLng(),
            });
            setLevel(map.getLevel());
          }}
        >
          {!!currentPosition && (
            <CustomOverlayMap position={currentPosition}>
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-primary/20 animate-ping absolute inset-0" />
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center relative">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Navigation className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </CustomOverlayMap>
          )}
          {/* 2. 최적 경로 Polyline (안심길 - 초록색) */}
          {path.length > 0 && (
            <Polyline
              path={path} // 현재 위치를 시작으로 하는 전체 경로
              strokeWeight={6}
              strokeColor={"#00FF00"} // 안심길 경로 색상을 초록색으로 변경
              strokeOpacity={0.8}
              strokeStyle={"solid"}
              endArrow={true}
            />
          )}

          {/* 4. [JSX 조건부 렌더링] - 마커와 클러스터는 여기서 처리 */}

          {/* none 모드일 때는 아무것도 렌더링하지 않음 */}

          {/* 클러스터 모드 (마커 모드 통합) */}
          {visualizationMode === "cluster" &&
            (securityLights.length > 0 ||
              safeReturnPaths.length > 0 ||
              emergencyBells.length > 0) && (
              <MarkerClusterer
                key={`cluster-${visualizationMode}-${securityLights.length}-${safeReturnPaths.length}-${emergencyBells.length}`} // key를 더 구체적으로 설정하여 확실히 리렌더링
                averageCenter={true}
                minLevel={1} // 줌 레벨 제한 해제 (모든 레벨에서 클러스터링 동작하되, 확대 시 마커가 보임)
                // calculator: 클러스터의 개수에 따라 등급(index)을 매기는 함수
                calculator={(size) => {
                  // 안심 귀갓길이 포함되면 가중치를 더 줄 수도 있지만,
                  // 여기서는 단순 개수로 처리하거나 필요 시 로직 수정 가능
                  // 기본 로직: 10개 미만 -> [0], 10~30 -> [1], 30~50 -> [2], 50 이상 -> [3]
                  // 여기서는 styles 배열 길이에 맞춰 [0], [1], [2] 리턴
                  if (size < 10) return [0];
                  if (size < 50) return [1];
                  return [2];
                }}
                // styles: 각 등급별(개수 적음 -> 많음) 스타일 정의
                styles={[
                  {
                    // 1단계 (개수가 적을 때)
                    width: "30px",
                    height: "30px",
                    background: "rgba(59, 130, 246, 0.8)", // 파란색 계열
                    borderRadius: "50%",
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: "30px",
                    fontWeight: "bold",
                    border: "1px solid rgba(59, 130, 246, 1)",
                  },
                  {
                    // 2단계 (개수가 중간일 때)
                    width: "40px",
                    height: "40px",
                    background: "rgba(245, 158, 11, 0.8)", // 주황색 계열
                    borderRadius: "50%",
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: "40px",
                    fontWeight: "bold",
                    border: "1px solid rgba(245, 158, 11, 1)",
                  },
                  {
                    // 3단계 (개수가 많을 때)
                    width: "50px",
                    height: "50px",
                    background: "rgba(239, 68, 68, 0.8)", // 빨간색 계열
                    borderRadius: "50%",
                    color: "#fff",
                    textAlign: "center",
                    lineHeight: "50px",
                    fontWeight: "bold",
                    border: "1px solid rgba(239, 68, 68, 1)",
                  },
                ]}
              >
                {renderMarkers()}
              </MarkerClusterer>
            )}

          {/* 히트맵 모드 */}
          {visualizationMode === "heatmap" &&
            (securityLights.length > 0 ||
              safeReturnPaths.length > 0 ||
              emergencyBells.length > 0) && (
              <HeatmapLayer
                data={securityLights}
                safeReturnPaths={safeReturnPaths}
                emergencyBells={emergencyBells}
              />
            )}

          {/* 4. 검색한 목적지 마커 */}
          {destinationInfo && (
            <>
              <MapMarker
                position={destinationInfo.coord}
                onClick={() => {
                  setShowDestinationOverlay(true);
                  openModal("route");
                }}
              />
              {showDestinationOverlay && (
                <CustomOverlayMap
                  position={destinationInfo.coord}
                  yAnchor={1.5}
                >
                  <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[200px] max-w-[300px]">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-semibold text-foreground text-sm">
                          {destinationInfo.place_name}
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDestinationOverlay(false);
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {destinationInfo.road_address_name && (
                        <p className="flex items-start gap-1">
                          <span className="font-medium">도로명:</span>
                          <span>{destinationInfo.road_address_name}</span>
                        </p>
                      )}
                      <p className="flex items-start gap-1">
                        <span className="font-medium">지번:</span>
                        <span>{destinationInfo.address_name}</span>
                      </p>
                    </div>
                  </div>
                </CustomOverlayMap>
              )}
            </>
          )}
        </Map>
        {/* 시각화 모드 전환 토글 */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex flex-col gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
            <Toggle
              pressed={visualizationMode === "none"}
              onPressedChange={(pressed) => {
                if (pressed) {
                  setVisualizationMode("none");
                  if (mapInstance && currentPosition) {
                    const moveLatLon = new kakao.maps.LatLng(
                      currentPosition.lat,
                      currentPosition.lng
                    );
                    mapInstance.panTo(moveLatLon);
                    mapInstance.setLevel(3); // 지도만 볼 때는 더 자세히 (3레벨)
                  }
                }
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-full justify-start"
              aria-label="지도만 보기"
            >
              <MapIcon className="h-3 w-3 mr-1" />
              <span className="text-xs">지도만</span>
            </Toggle>
            <Toggle
              pressed={visualizationMode === "cluster"}
              onPressedChange={(pressed) => {
                if (pressed) {
                  setVisualizationMode("cluster");
                  if (mapInstance && currentPosition) {
                    const moveLatLon = new kakao.maps.LatLng(
                      currentPosition.lat,
                      currentPosition.lng
                    );
                    mapInstance.panTo(moveLatLon);
                    mapInstance.setLevel(6);
                  }
                } else {
                  // 토글 해제 시 클러스터 인스턴스를 삭제(리셋)하기 위해 모드 변경
                  setVisualizationMode("none");
                }
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-full justify-start"
              aria-label="클러스터 모드"
            >
              <Layers className="h-3 w-3 mr-1" />
              <span className="text-xs">클러스터</span>
            </Toggle>
            <Toggle
              pressed={visualizationMode === "heatmap"}
              onPressedChange={(pressed) => {
                if (pressed) {
                  setVisualizationMode("heatmap");
                  if (mapInstance && currentPosition) {
                    const moveLatLon = new kakao.maps.LatLng(
                      currentPosition.lat,
                      currentPosition.lng
                    );
                    mapInstance.panTo(moveLatLon);
                    mapInstance.setLevel(3); // 히트맵도 자세히 보기 위해 레벨 3으로 변경
                  }
                } else {
                  setVisualizationMode("none");
                }
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-full justify-start"
              aria-label="히트맵 모드"
            >
              <Grid3x3 className="h-3 w-3 mr-1" />
              <span className="text-xs">히트맵</span>
            </Toggle>
          </div>
        </div>
        {/* 지도 타입 전환 토글 */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
            <Toggle
              pressed={mapType === "roadmap"}
              onPressedChange={(pressed) => {
                if (pressed) setMapType("roadmap");
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              aria-label="일반 지도"
            >
              <MapIcon className="h-4 w-4" />
              <span className="text-xs">지도</span>
            </Toggle>
            <Toggle
              pressed={mapType === "skyview"}
              onPressedChange={(pressed) => {
                if (pressed) setMapType("skyview");
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              aria-label="스카이뷰"
            >
              <Satellite className="h-4 w-4" />
              <span className="text-xs">스카이뷰</span>
            </Toggle>
          </div>
        </div>
      </div>
    </>
  );
}
