"use client";

import { Map, Polyline, CustomOverlayMap } from "react-kakao-maps-sdk";
import useKakaoLoader from "@/hooks/useKakaoLoader";
import { useRef, useState, useEffect, useMemo } from "react";
import AddMapCustomControlStyle from "./addMapCustomControl.style";
import { MapMarker } from "react-kakao-maps-sdk";
import { Navigation, MapPin, X, Map as MapIcon, Satellite } from "lucide-react";
import { useMapStore } from "@/store/mapStore";
import { useUIStore } from "@/store/uiStore";
import { Toggle } from "@/components/ui/toggle";

export default function BasicMap() {
  useKakaoLoader();
  const mapRef = useRef<kakao.maps.Map>(null);
  const [mapType, setMapType] = useState<"roadmap" | "skyview">("roadmap");
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);

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
  } = useMapStore();
  const { openModal } = useUIStore();
  const [loading, setLoading] = useState(true);
  const hasCheckedDebug = useRef(false);

  // 이전 요청 취소를 위한 AbortController (컴포넌트 최상위로 이동)
  const abortControllerRef = useRef<AbortController | null>(null);
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
    const map = mapRef.current;
    if (!map) return;

    const moveLatLon = new kakao.maps.LatLng(center.lat, center.lng);
    map.setCenter(moveLatLon);
  }, [center]);

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
                console.log("[지도] DB 전체 데이터 확인:", debugData);
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
      } catch (error) {
        // AbortError는 무시 (의도적인 취소)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("[지도] 보안등 데이터 가져오기 실패:", error);
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
      kakao.maps.event.removeListener(map, "tilesloaded", handleLoad);
      kakao.maps.event.removeListener(map, "idle", handleIdle);
    };
  }, [setSecurityLights, loading, mapInstance]);

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
          onCenterChanged={(map) => {
            const centerPos = map.getCenter();
            setCenter({
              lat: centerPos.getLat(),
              lng: centerPos.getLng(),
            });
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

          {/* 5. 보안등 마커 */}
          {securityLights && securityLights.length > 0 && (
            <>
              {securityLights.map((light) => {
                // 좌표 유효성 검사
                if (
                  !light.latitude ||
                  !light.longitude ||
                  typeof light.latitude !== "number" ||
                  typeof light.longitude !== "number" ||
                  isNaN(light.latitude) ||
                  isNaN(light.longitude)
                ) {
                  return null;
                }

                // 보안등 위치 정보로 타이틀 생성
                const title =
                  light.address_lot ||
                  `${light.si_do || ""} ${light.si_gun_gu || ""} ${
                    light.eup_myeon_dong || ""
                  }`.trim() ||
                  "보안등";

                return (
                  <MapMarker
                    key={light.id}
                    position={{ lat: light.latitude, lng: light.longitude }}
                    image={{
                      src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
                      size: {
                        width: 24,
                        height: 35,
                      },
                    }}
                    title={title}
                  />
                );
              })}
            </>
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
