"use client";

import { Map } from "react-kakao-maps-sdk";
import useKakaoLoader from "@/hooks/useKakaoLoader";
import { useState, useEffect } from "react";

interface Position {
  lat: number;
  lng: number;
}

export default function BasicMap() {
  useKakaoLoader();
  const [position, setPosition] = useState<Position>({
    lat: 33.450701, // 기본값 (제주도)
    lng: 126.570667,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 현재 위치 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setPosition({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLoading(false);
        },
        (error) => {
          console.error("위치 정보를 가져올 수 없습니다:", error);
          setLoading(false);
          // 기본값 유지
        }
      );
    } else {
      console.error("Geolocation을 지원하지 않는 브라우저입니다.");
      setLoading(false);
    }
  }, []);

  if (loading) {
    return (
      <div className="w-full h-[350px] flex items-center justify-center bg-gray-100">
        <p>위치 정보를 가져오는 중...</p>
      </div>
    );
  }

  return (
    <Map
      id="map"
      center={{
        lat: position.lat,
        lng: position.lng,
      }}
      style={{
        width: "100%",
        height: "350px",
      }}
      level={3}
    />
  );
}
