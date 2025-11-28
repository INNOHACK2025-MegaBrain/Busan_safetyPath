import { useEffect, useState } from "react";
import { Circle, useMap } from "react-kakao-maps-sdk";

interface HeatmapLayerProps {
  data: { latitude: number; longitude: number }[]; // 보안등 데이터
  safeReturnPaths?: Array<{
    start_latitude: number;
    start_longitude: number;
    end_latitude: number;
    end_longitude: number;
  }>; // 안심 귀갓길 데이터 (옵션)
  emergencyBells?: Array<{
    latitude: number;
    longitude: number;
  }>; // 비상벨 데이터 (옵션)
}

interface GridCell {
  center: { lat: number; lng: number };
  radius: number;
  count: number;
  opacity: number;
  color: string; // 색상 속성 추가
  key: string;
}

export default function HeatmapLayer({
  data,
  safeReturnPaths,
  emergencyBells,
}: HeatmapLayerProps) {
  const map = useMap(); // 부모 Map 컴포넌트의 인스턴스를 가져옵니다.
  const [gridCells, setGridCells] = useState<GridCell[]>([]);

  useEffect(() => {
    // 데이터가 없으면 렌더링 안 함 (셋 다 없을 때)
    if (
      !map ||
      ((!data || data.length === 0) &&
        (!safeReturnPaths || safeReturnPaths.length === 0) &&
        (!emergencyBells || emergencyBells.length === 0))
    )
      return;

    const calculateGrid = () => {
      const bounds = map.getBounds();
      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();

      // 1. 그리드 해상도 증가 (더 세밀하게 표현)
      const gridSize = 40;
      const latRange = ne.getLat() - sw.getLat();
      const lngRange = ne.getLng() - sw.getLng();
      const latStep = latRange / gridSize;
      const lngStep = lngRange / gridSize;

      // 원의 반지름 계산 (격자 크기에 비례, 약간 겹치게 설정하여 부드러운 효과)
      const radius = latStep * 111000 * 0.8;

      const cells = [];
      let maxCount = 0;

      // 안심 귀갓길 포인트 추출 (시작점과 끝점을 모두 포인트로 사용)
      const safePathPoints: { latitude: number; longitude: number }[] = [];
      if (safeReturnPaths) {
        safeReturnPaths.forEach((path) => {
          safePathPoints.push({
            latitude: path.start_latitude,
            longitude: path.start_longitude,
          });
          safePathPoints.push({
            latitude: path.end_latitude,
            longitude: path.end_longitude,
          });
        });
      }

      // 비상벨 포인트 추출
      const bellPoints: { latitude: number; longitude: number }[] = [];
      if (emergencyBells) {
        emergencyBells.forEach((bell) => {
          bellPoints.push({
            latitude: bell.latitude,
            longitude: bell.longitude,
          });
        });
      }

      // 2. 각 격자(Cell)별 데이터 카운팅
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const cellSwLat = sw.getLat() + i * latStep;
          const cellSwLng = sw.getLng() + j * lngStep;
          const cellNeLat = cellSwLat + latStep;
          const cellNeLng = cellSwLng + lngStep;

          // 격자 중심점
          const centerLat = cellSwLat + latStep / 2;
          const centerLng = cellSwLng + lngStep / 2;

          // 현재 격자에 포함되는 보안등 필터링
          const lightCount = data
            ? data.filter(
                (point) =>
                  point.latitude >= cellSwLat &&
                  point.latitude < cellNeLat &&
                  point.longitude >= cellSwLng &&
                  point.longitude < cellNeLng
              ).length
            : 0;

          // 현재 격자에 포함되는 안심 귀갓길 포인트 필터링
          const safePathCount = safePathPoints.filter(
            (point) =>
              point.latitude >= cellSwLat &&
              point.latitude < cellNeLat &&
              point.longitude >= cellSwLng &&
              point.longitude < cellNeLng
          ).length;

          // 현재 격자에 포함되는 비상벨 포인트 필터링
          const bellCount = bellPoints.filter(
            (point) =>
              point.latitude >= cellSwLat &&
              point.latitude < cellNeLat &&
              point.longitude >= cellSwLng &&
              point.longitude < cellNeLng
          ).length;

          // 안심 귀갓길과 비상벨은 가중치를 10배로 적용
          const count = lightCount + safePathCount * 10 + bellCount * 10;

          if (count > 0) {
            if (count > maxCount) maxCount = count;
            cells.push({
              center: { lat: centerLat, lng: centerLng },
              radius,
              count,
            });
          }
        }
      }

      // 3. 렌더링을 위한 데이터 가공
      const renderData = cells.map((cell) => {
        const density = cell.count / maxCount;

        // 밀도에 따른 색상 결정 (Green Scale - 초록색 단색 그라데이션)
        // Tailwind CSS Green Colors 참조
        let color = "#DCFCE7"; // 0~20%: Green-100 (매우 낮음)
        if (density > 0.8) color = "#15803D"; // 80~100%: Green-700 (매우 높음)
        else if (density > 0.6) color = "#22C55E"; // 60~80%: Green-500 (높음)
        else if (density > 0.4) color = "#4ADE80"; // 40~60%: Green-400 (중간)
        else if (density > 0.2) color = "#86EFAC"; // 20~40%: Green-300 (낮음)

        // 투명도 조정: 진한 색은 투명도를 조금 낮춰서 너무 어둡지 않게,
        // 연한 색은 투명도를 높여서 배경과 잘 섞이게
        // 0.4 ~ 0.7 범위
        const opacity = 0.4 + density * 0.3;

        return {
          ...cell,
          color,
          opacity,
          key: `${cell.center.lat}-${cell.center.lng}`,
        };
      });

      setGridCells(renderData);
    };

    // 지도 이동/줌 이벤트 리스너 등록
    const handleIdle = () => calculateGrid();

    // 초기 실행
    calculateGrid();

    // 이벤트 등록
    kakao.maps.event.addListener(map, "idle", handleIdle);

    return () => {
      kakao.maps.event.removeListener(map, "idle", handleIdle);
    };
  }, [map, data, safeReturnPaths, emergencyBells]);

  return (
    <>
      {gridCells.map((cell) => (
        <Circle
          key={cell.key}
          center={cell.center}
          radius={cell.radius}
          fillColor={cell.color} // 동적 색상 적용
          fillOpacity={cell.opacity}
          strokeWeight={0} // 테두리 없음
        />
      ))}
    </>
  );
}
