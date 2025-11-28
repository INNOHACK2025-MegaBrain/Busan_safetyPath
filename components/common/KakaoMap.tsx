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
  MapPinned,
} from "lucide-react";
import { useMapStore } from "@/store/mapStore";
import { useUIStore } from "@/store/uiStore";
import { Toggle } from "@/components/ui/toggle";

export default function BasicMap() {
  useKakaoLoader();
  const mapRef = useRef<kakao.maps.Map>(null);
  const [mapType, setMapType] = useState<"roadmap" | "skyview">("roadmap");
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<
    "none" | "markers" | "cluster" | "heatmap"
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

  // 보안등 밀도 계산 및 Zone 오버레이
  useEffect(() => {
    // heatmap 모드가 아니면 아무것도 안 함
    if (visualizationMode !== "heatmap") return;

    const map = mapInstance || mapRef.current;
    if (!map || !securityLights || securityLights.length === 0) {
      return;
    }

    // 그리드 기반 밀도 계산
    const calculateDensity = () => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const swLatLng = bounds.getSouthWest();
      const neLatLng = bounds.getNorthEast();
      const gridSize = 20; // 20x20 그리드
      const latStep = (neLatLng.getLat() - swLatLng.getLat()) / gridSize;
      const lngStep = (neLatLng.getLng() - swLatLng.getLng()) / gridSize;

      const grid: Array<{
        sw: { lat: number; lng: number };
        ne: { lat: number; lng: number };
        count: number;
      }> = [];

      // 각 그리드 셀에 보안등 개수 계산
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const swLat = swLatLng.getLat() + i * latStep;
          const swLng = swLatLng.getLng() + j * lngStep;
          const neLat = swLat + latStep;
          const neLng = swLng + lngStep;

          const count = securityLights.filter(
            (light) =>
              light.latitude >= swLat &&
              light.latitude < neLat &&
              light.longitude >= swLng &&
              light.longitude < neLng
          ).length;

          grid.push({
            sw: { lat: swLat, lng: swLng },
            ne: { lat: neLat, lng: neLng },
            count,
          });
        }
      }

      return grid;
    };

    const grid = calculateDensity();
    if (!grid) return;

    // 오버레이 생성
    const overlays: kakao.maps.CustomOverlay[] = [];

    grid.forEach((cell) => {
      if (cell.count === 0) return; // 보안등이 없는 셀은 표시하지 않음

      // 밀도에 따라 색상 결정
      const maxCount = Math.max(...grid.map((g) => g.count));
      const density = cell.count / maxCount;

      // Green Zone: 밀도 높음, Grey Zone: 밀도 낮음
      const color =
        density > 0.5
          ? `rgba(34, 197, 94, ${density * 0.3})` // Green Zone
          : `rgba(107, 114, 128, ${density * 0.2})`; // Grey Zone

      const overlay = new kakao.maps.CustomOverlay({
        content: `<div style="width:100%;height:100%;background:${color};"></div>`,
        position: new kakao.maps.LatLng(
          (cell.sw.lat + cell.ne.lat) / 2,
          (cell.sw.lng + cell.ne.lng) / 2
        ),
        xAnchor: 0.5,
        yAnchor: 0.5,
      });

      // 사각형 영역을 표시하기 위해 커스텀 오버레이 사용
      const rect = new kakao.maps.Rectangle({
        bounds: new kakao.maps.LatLngBounds(
          new kakao.maps.LatLng(cell.sw.lat, cell.sw.lng),
          new kakao.maps.LatLng(cell.ne.lat, cell.ne.lng)
        ),
        fillColor: color,
        fillOpacity: 0.3,
        strokeWeight: 0,
      });

      rect.setMap(map);
      overlays.push(overlay);
    });

    return () => {
      overlays.forEach((overlay) => overlay.setMap(null));
    };
  }, [mapInstance, securityLights, visualizationMode]); // visualizationMode 의존성 추가

  // 3. [마커 렌더링 헬퍼 함수] - return 문 전에 추가 (370줄 근처, if (loading) 전에)
  const renderMarkers = () => {
    if (!securityLights || securityLights.length === 0) return null;

    return securityLights
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
            key={light.id}
            position={{ lat: light.latitude, lng: light.longitude }}
            title={title}
            image={{
              src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png",
              size: { width: 24, height: 35 },
            }}
          />
        );
      });
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
          onCenterChanged={(map) => {
            const centerPos = map.getCenter();
            setCenter({
              lat: centerPos.getLat(),
              lng: centerPos.getLng(),
            });
          }}
          onZoomChanged={(map) => {
            // 클러스터 모드일 때 줌 레벨이 6보다 작으면(더 확대되면) 6으로 제한
            if (visualizationMode === "cluster") {
              const currentLevel = map.getLevel();
              if (currentLevel < 6) {
                // requestAnimationFrame을 사용하여 즉시 실행
                requestAnimationFrame(() => {
                  map.setLevel(6);
                });
              }
            }
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

          {/* 클러스터 모드 */}
          {visualizationMode === "cluster" && (
            <MarkerClusterer
              averageCenter={true}
              minLevel={6}
              // calculator: 클러스터의 개수에 따라 등급(index)을 매기는 함수 (기본값 사용해도 됨)
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
          {/* 마커 모드 */}
          {visualizationMode === "markers" && renderMarkers()}

          {/* 히트맵 모드일 때는 useEffect에서 사각형을 그렸으므로 여기서는 아무것도 안 함 */}

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
                if (pressed) setVisualizationMode("none");
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
              pressed={visualizationMode === "markers"}
              onPressedChange={(pressed) => {
                if (pressed) setVisualizationMode("markers");
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-full justify-start"
              aria-label="마커 모드"
            >
              <MapPinned className="h-3 w-3 mr-1" />
              <span className="text-xs">마커</span>
            </Toggle>
            <Toggle
              pressed={visualizationMode === "cluster"}
              onPressedChange={(pressed) => {
                if (pressed) setVisualizationMode("cluster");
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
                if (pressed) setVisualizationMode("heatmap");
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
