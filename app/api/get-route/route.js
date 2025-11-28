// app/api/get-route/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// 두 좌표 간 거리 계산 (Haversine formula)
function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371; // 지구 반경 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export async function POST(request) {
  try {
    // 1. 프론트엔드(화면)에서 보낸 출발/도착지 좌표 받기
    const body = await request.json();
    const { start, end, weights } = body; // weights 추가

    // 2. 거리 계산
    const distance = calculateDistance(start.lat, start.lng, end.lat, end.lng);

    // 최대 거리 제한 (예: 100km)
    const MAX_DISTANCE = 100;
    if (distance > MAX_DISTANCE) {
      console.log(
        `거리가 ${distance.toFixed(
          2
        )}km로 최대 거리(${MAX_DISTANCE}km)를 초과했습니다.`
      );
      return NextResponse.json(
        {
          error: "거리 제한 초과",
          message: "너무 먼 거리의 경로를 선택하셨습니다.",
          details: {
            distance: distance.toFixed(2) + "km",
            maxDistance: MAX_DISTANCE + "km",
            start,
            end,
          },
        },
        { status: 400 }
      );
    }

    // 3. 거리에 따라 적절한 프로필 선택
    // 도보는 10km 이하의 짧은 거리만 사용
    // 10km 초과면 자동차 프로필 사용 (안심길 우선은 가중치로 처리)
    let profile = "foot";
    // MAX_DISTANCE가 50km이므로, 50km 초과는 이미 위에서 차단됨
    // 하지만 프로필 선택 로직은 유지 (향후 MAX_DISTANCE 변경 대비)
    if (distance > 10) {
      profile = "car";
      console.log(`거리가 ${distance.toFixed(2)}km로 자동차 프로필 사용`);
    }

    // 4. 도커에 떠있는 GraphHopper 서버 주소
    const graphHopperUrl = "http://127.0.0.1:8989/route";

    // 5. GraphHopper에 보낼 데이터 (여기가 핵심!)
    const payload = {
      points: [
        [start.lng, start.lat], // GraphHopper는 [경도, 위도] 순서임!
        [end.lng, end.lat],
      ],
      profile: profile, // 거리에 따라 자동 선택
      locale: "ko",
      calc_points: true,
      points_encoded: false, // 좌표를 압축하지 말고 다 달라고 함
      "ch.disable": true, // 커스텀 모델(가중치)을 쓰기 위해 필수
      // alternative_route 설정을 Body에 포함 (더 확실한 적용)
      algorithm: "alternative_route",
      "alternative_route.max_paths": 3, // 최대 3개 경로 요청
      "alternative_route.max_weight_factor": 1.4,
      "alternative_route.max_share_factor": 0.6,

      // ▼ 여기가 안심길 우선 가중치 설정 부분입니다.
      custom_model: {
        priority: [
          // weights를 기반으로 가중치 설정
          // roadSafety: 도로 안전도 (높을수록 안전한 도로 선호)
          {
            if: "road_class == PRIMARY",
            multiply_by: weights?.roadSafety
              ? (1 / weights.roadSafety).toString()
              : "0.7", // 기본값: 큰 도로 선호
          },
          // crime: 범죄율 (높을수록 회피)
          {
            if: "road_class == SERVICE",
            multiply_by: weights?.crime ? weights.crime.toString() : "1.5", // 기본값: 골목길 회피
          },
          // light: 조명 (높을수록 밝은 길 선호)
          // cctv: CCTV 밀도 (높을수록 CCTV 많은 길 선호)
          // 추가 조건은 GraphHopper의 도로 속성에 따라 확장 가능
        ],
        distance_influence: 100,
      },
    };

    // 1. GraphHopper에 다중 경로 요청을 위한 쿼리 파라미터 (Body에 포함했으므로 최소화)
    const query = new URLSearchParams({});

    // 4. GraphHopper에 요청 보내기
    let res = await fetch(`${graphHopperUrl}?${query.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    // foot 프로필이 없으면 car로 폴백
    if (!res.ok && profile === "foot") {
      const errorText = await res.text();
      try {
        const errorData = JSON.parse(errorText);
        if (
          errorData.message &&
          errorData.message.includes("does not exist") &&
          errorData.message.includes("foot")
        ) {
          console.log(
            "foot 프로필이 없어 car 프로필로 폴백 (거리: " +
              distance.toFixed(2) +
              "km)"
          );
          profile = "car";
          payload.profile = "car";

          // car 프로필로 재시도
          res = await fetch(`${graphHopperUrl}?${query.toString()}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        } else {
          // 다른 에러인 경우
          console.error("GraphHopper HTTP 오류:", res.status, errorText);
          return NextResponse.json(
            {
              error: "GraphHopper API 오류",
              message: errorText,
              status: res.status,
            },
            { status: res.status }
          );
        }
      } catch {
        // JSON 파싱 실패
        console.error("GraphHopper HTTP 오류:", res.status, errorText);
        return NextResponse.json(
          {
            error: "GraphHopper API 오류",
            message: errorText,
            status: res.status,
          },
          { status: res.status }
        );
      }
    }

    // GraphHopper 응답 상태 확인
    if (!res.ok) {
      const errorText = await res.text();
      console.error("GraphHopper HTTP 오류:", res.status, errorText);
      return NextResponse.json(
        {
          error: "GraphHopper API 오류",
          message: errorText,
          status: res.status,
        },
        { status: res.status }
      );
    }

    const data = await res.json();

    if (data.paths) {
      console.log(`[Route] GraphHopper 반환 경로 개수: ${data.paths.length}`);
    }

    // GraphHopper가 경로를 찾지 못한 경우 (빈 응답 또는 paths 없음)
    if (!data.paths || data.paths.length === 0 || !data.paths[0]) {
      console.error(
        "GraphHopper 경로 없음 - 응답:",
        JSON.stringify(data, null, 2)
      );
      console.error("요청 좌표:", {
        start,
        end,
        distance: distance.toFixed(2) + "km",
        profile,
      });

      // 거리가 MAX_DISTANCE에 가까운 경우 특별 메시지
      const distanceRatio = (distance / MAX_DISTANCE) * 100;
      let errorMessage = "경로를 찾을 수 없습니다.";

      if (distanceRatio > 80) {
        errorMessage =
          "거리가 너무 멀어 경로를 찾을 수 없습니다. 더 가까운 목적지를 선택해주세요.";
      } else if (data.message) {
        // GraphHopper의 에러 메시지가 있으면 활용
        errorMessage = `경로를 찾을 수 없습니다: ${data.message}`;
      } else {
        errorMessage =
          "해당 좌표 간 경로를 찾을 수 없습니다. 지하철역의 경우 지상 출입구 좌표를 사용해주세요.";
      }

      return NextResponse.json(
        {
          error: "경로를 찾을 수 없습니다",
          message: errorMessage,
          details: {
            start,
            end,
            distance: distance.toFixed(2) + "km",
            maxDistance: MAX_DISTANCE + "km",
            profile,
            distanceRatio: distanceRatio.toFixed(1) + "%",
          },
        },
        { status: 404 }
      );
    }

    // GraphHopper 에러 메시지 확인
    if (data.message) {
      console.error("GraphHopper 에러 메시지:", data.message);
      return NextResponse.json(
        {
          error: "GraphHopper 오류",
          message: data.message,
          details: data,
        },
        { status: 400 }
      );
    }

    // 2. 경로가 여러 개 왔을 때 평가 로직 수행
    if (data.paths && data.paths.length > 0) {
      try {
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        );

        // 전체 경로들을 포함하는 Bounding Box 계산
        let minLat = 90,
          maxLat = -90,
          minLng = 180,
          maxLng = -180;
        let hasBbox = false;

        data.paths.forEach((path) => {
          const bbox = path.bbox; // [minLon, minLat, maxLon, maxLat]
          if (bbox) {
            minLng = Math.min(minLng, bbox[0]);
            minLat = Math.min(minLat, bbox[1]);
            maxLng = Math.max(maxLng, bbox[2]);
            maxLat = Math.max(maxLat, bbox[3]);
            hasBbox = true;
          }
        });

        if (hasBbox) {
          // DB에서 해당 영역 내 보안등 조회 (약간의 버퍼 추가)
          const buffer = 0.003; // 약 300m

          const { data: lights, error } = await supabase
            .from("security_lights")
            .select("latitude, longitude")
            .gte("latitude", minLat - buffer)
            .lte("latitude", maxLat + buffer)
            .gte("longitude", minLng - buffer)
            .lte("longitude", maxLng + buffer);

          if (!error && lights && lights.length > 0) {
            console.log(`[Route] 조회된 보안등 개수: ${lights.length}`);

            // 각 경로별 보안등 점수 계산
            data.paths.forEach((path) => {
              const points = path.points.coordinates; // [lon, lat] 배열
              const pathLights = new Set(); // 중복 카운트 방지 (좌표 문자열 사용)

              // 경로 포인트 샘플링하여 주변 보안등 확인
              // 모든 점을 확인하면 느릴 수 있으므로 5개씩 건너뛰며 확인 (약 10~20m 간격 될 듯)
              for (let i = 0; i < points.length; i += 5) {
                const [pLng, pLat] = points[i];

                // 보안등 데이터 순회 (지역 필터링된 데이터라 크지 않음)
                for (const light of lights) {
                  // 간단한 거리 계산 (제곱 거리 비교가 더 빠름)
                  const dLat = light.latitude - pLat;
                  const dLng = light.longitude - pLng;
                  // 0.0005도 ≈ 50m (범위 완화: 0.0003 -> 0.0005)
                  if (dLat * dLat + dLng * dLng < 0.0005 * 0.0005) {
                    pathLights.add(`${light.latitude},${light.longitude}`);
                  }
                }
              }

              // 점수 할당 (보안등 개수)
              path.securityScore = pathLights.size;

              // 디버깅용 로그
              // console.log(`Path score: ${path.securityScore}, distance: ${path.distance}`);
            });

            // 보안등 점수가 높은 순으로 정렬
            data.paths.sort(
              (a, b) => (b.securityScore || 0) - (a.securityScore || 0)
            );

            console.log(
              "[Route] 경로별 보안등 점수(정렬후):",
              data.paths.map((p) => p.securityScore)
            );
          } else {
            console.log("[Route] 조회된 보안등이 없거나 에러 발생:", error);
          }
        }
      } catch (err) {
        console.error("보안등 점수 계산 중 오류:", err);
      }
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("경로 요청 에러:", error);
    return NextResponse.json({ error: "길찾기 실패" }, { status: 500 });
  }
}
