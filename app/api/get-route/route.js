// app/api/get-route/route.js
import { NextResponse } from "next/server";

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

    // 3. 거리에 따라 적절한 프로필 선택
    // 도보는 10km 이하의 짧은 거리만 사용
    // 10km 초과면 자동차 프로필 사용 (안심길 우선은 가중치로 처리)
    let profile = "foot";
    if (distance > 50) {
      profile = "car";
      console.log(
        `거리가 ${distance.toFixed(2)}km로 너무 멀어 자동차 프로필 사용`
      );
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

    // 4. GraphHopper에 요청 보내기
    let res = await fetch(graphHopperUrl, {
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
          res = await fetch(graphHopperUrl, {
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
      });

      return NextResponse.json(
        {
          error: "경로를 찾을 수 없습니다",
          message:
            "GraphHopper가 해당 좌표 간 경로를 찾을 수 없습니다. 지하철역의 경우 지상 출입구 좌표를 사용해주세요.",
          details: {
            start,
            end,
            distance: distance.toFixed(2) + "km",
            profile,
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

    return NextResponse.json(data);
  } catch (error) {
    console.error("경로 요청 에러:", error);
    return NextResponse.json({ error: "길찾기 실패" }, { status: 500 });
  }
}
