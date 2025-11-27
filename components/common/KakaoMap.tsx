"use client";

import { Map, Polyline, CustomOverlayMap } from "react-kakao-maps-sdk";
import useKakaoLoader from "@/hooks/useKakaoLoader";
import { useRef, useState, useEffect, useMemo } from "react";
import AddMapCustomControlStyle from "./addMapCustomControl.style";
import { MapMarker } from "react-kakao-maps-sdk";
import { Navigation, MapPin, X } from "lucide-react";
import { useMapStore } from "@/store/mapStore";

interface Position {
  lat: number;
  lng: number;
}

const PATH_WAYPOINTS_AND_END: Position[] = [
  // { lat: 33.450701, lng: 126.570667 } <-- 출발점은 비워둡니다 (현재 위치로 대체)
  { lat: 33.45156, lng: 126.57212 }, // 경유지 1
  { lat: 33.451393, lng: 126.574424 }, // 경유지 2
  { lat: 33.450417, lng: 126.575026 }, // 경유지 3
  { lat: 33.452377, lng: 126.576829 }, // 최종 도착 지점
];

export default function BasicMap() {
  useKakaoLoader();
  const mapRef = useRef<kakao.maps.Map>(null);
  const [mapType, setMapType] = useState<"roadmap" | "skyview">("roadmap");

  // mapStore에서 center와 destinationInfo 가져오기
  const { center, setCenter, destinationInfo } = useMapStore();
  const [showOverlay, setShowOverlay] = useState(false);

  const [currentPosition, setCurrentPosition] = useState<Position>({
    lat: center.lat,
    lng: center.lng,
  });
  const [loading, setLoading] = useState(true);

  // 1. 현재 위치와 정의된 경유지/도착지를 합쳐 최종 경로(path)를 동적으로 생성
  const path = useMemo(() => {
    // 현재 위치를 경로의 첫 번째 지점으로 추가합니다.
    const fullPath = [currentPosition, ...PATH_WAYPOINTS_AND_END];

    return fullPath.map((p) => ({
      lat: p.lat,
      lng: p.lng,
    }));
  }, [currentPosition]); // currentPosition이 변경될 때마다 경로를 다시 계산

  useEffect(() => {
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
          setCurrentPosition(center);
          setLoading(false);
        }
      );
    } else {
      console.error("Geolocation을 지원하지 않는 브라우저입니다.");
      queueMicrotask(() => {
        setCurrentPosition(center);
        setLoading(false);
      });
    }
  }, [center, setCenter]);

  // mapStore의 center가 변경될 때 지도 이동
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const moveLatLon = new kakao.maps.LatLng(center.lat, center.lng);
    map.setCenter(moveLatLon);
  }, [center]);

  if (loading) {
    return (
      <div className="w-full h-[350px] flex items-center justify-center bg-gray-100">
        <p>위치 정보를 가져오는 중...</p>
      </div>
    );
  }

  // 경로의 최종 도착 지점
  const finalDestination =
    PATH_WAYPOINTS_AND_END[PATH_WAYPOINTS_AND_END.length - 1];
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
          {/* 2. 최적 경로 Polyline */}
          <Polyline
            path={path} // 현재 위치를 시작으로 하는 전체 경로
            strokeWeight={5}
            strokeColor={"#1E90FF"} // 경로 색상을 파란색 계열로 변경
            strokeOpacity={0.9}
            endArrow={true}
          />

          {/* 3. 경로 도착점 마커 */}
          <MapMarker
            position={finalDestination}
            title="경로 도착"
            image={{
              src: "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_number_icon.png",
              size: { width: 32, height: 37 },
              options: { offset: { x: 16, y: 34 } },
            }}
          />

          {/* 4. 검색한 목적지 마커 */}
          {destinationInfo && (
            <>
              <MapMarker
                position={destinationInfo.coord}
                onClick={() => setShowOverlay(true)}
              />
              {showOverlay && (
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
                          setShowOverlay(false);
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
        <div className="custom_typecontrol radius_border">
          <span
            id="btnRoadmap"
            className={mapType === "roadmap" ? "selected_btn" : "btn"}
            onClick={() => setMapType("roadmap")}
          >
            지도
          </span>
          <span
            id="btnSkyview"
            className={mapType === "skyview" ? "selected_btn" : "btn"}
            onClick={() => {
              setMapType("skyview");
            }}
          >
            스카이뷰
          </span>
        </div>
      </div>
    </>
  );
}
