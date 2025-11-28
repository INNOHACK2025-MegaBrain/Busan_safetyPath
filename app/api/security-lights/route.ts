import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET: 현재 지도 영역의 보안등 조회
export async function GET(request: NextRequest) {
  console.log("[API] 보안등 API 호출됨");
  try {
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error("[API] Supabase 환경 변수가 설정되지 않았습니다.");
      return NextResponse.json({ error: "서버 설정 오류" }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    console.log("[API] Supabase 클라이언트 생성 완료");

    // 쿼리 파라미터에서 지도 영역 가져오기
    const { searchParams } = new URL(request.url);
    const swLat = parseFloat(searchParams.get("swLat") || "0");
    const swLng = parseFloat(searchParams.get("swLng") || "0");
    const neLat = parseFloat(searchParams.get("neLat") || "0");
    const neLng = parseFloat(searchParams.get("neLng") || "0");

    console.log("[API] 받은 쿼리 파라미터:", {
      swLat,
      swLng,
      neLat,
      neLng,
      rawSwLat: searchParams.get("swLat"),
      rawSwLng: searchParams.get("swLng"),
      rawNeLat: searchParams.get("neLat"),
      rawNeLng: searchParams.get("neLng"),
    });

    // 디버그 모드: 전체 데이터 개수 확인
    if (searchParams.get("debug") === "true") {
      console.log("[API] 디버그 모드: 전체 데이터 확인");
      const { count, error: countError } = await supabase
        .from("security_lights")
        .select("*", { count: "exact", head: true });

      console.log("[API] 전체 개수 조회 결과:", count, "에러:", countError);

      const { data: sampleData, error: sampleError } = await supabase
        .from("security_lights")
        .select("id, latitude, longitude, si_do, si_gun_gu")
        .not("latitude", "is", null)
        .not("longitude", "is", null)
        .limit(5);

      console.log(
        "[API] 샘플 데이터 조회 결과:",
        sampleData?.length || 0,
        "개, 에러:",
        sampleError
      );

      return NextResponse.json({
        totalCount: count,
        countError: countError?.message,
        sampleData: sampleData || [],
        sampleError: sampleError?.message,
      });
    }

    if (!swLat || !swLng || !neLat || !neLng) {
      return NextResponse.json(
        { error: "지도 영역 정보가 필요합니다." },
        { status: 400 }
      );
    }

    // 보안등 조회: 위도와 경도가 현재 지도 영역 내에 있는 것만
    const minLat = Math.min(swLat, neLat);
    const maxLat = Math.max(swLat, neLat);
    const minLng = Math.min(swLng, neLng);
    const maxLng = Math.max(swLng, neLng);

    console.log(`[API] 조회 영역 계산:`, {
      원본: { swLat, swLng, neLat, neLng },
      계산된: { minLat, maxLat, minLng, maxLng },
      범위: {
        latRange: `${minLat.toFixed(6)} ~ ${maxLat.toFixed(6)}`,
        lngRange: `${minLng.toFixed(6)} ~ ${maxLng.toFixed(6)}`,
      },
    });

    // 테스트: 부산 지역 샘플 데이터 좌표 범위 확인
    // 샘플 데이터: lat: 35.073, lng: 128.839
    const sampleLat = 35.07328616;
    const sampleLng = 128.8397788;
    const isInRange =
      sampleLat >= minLat &&
      sampleLat <= maxLat &&
      sampleLng >= minLng &&
      sampleLng <= maxLng;
    console.log(
      `[API] 샘플 데이터(35.073, 128.839)가 조회 영역에 포함되는가?`,
      isInRange
    );

    // geom 필드가 있으면 공간 쿼리 사용, 없으면 일반 쿼리 사용
    console.log("[API] Supabase 쿼리 시작");
    const query = supabase
      .from("security_lights")
      .select(
        "id, latitude, longitude, si_do, si_gun_gu, eup_myeon_dong, address_lot"
      )
      .gte("latitude", minLat)
      .lte("latitude", maxLat)
      .gte("longitude", minLng)
      .lte("longitude", maxLng)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .limit(1000);

    console.log("[API] 쿼리 조건:", {
      "latitude >= minLat": minLat,
      "latitude <= maxLat": maxLat,
      "longitude >= minLng": minLng,
      "longitude <= maxLng": maxLng,
    });

    const { data, error } = await query;

    console.log("[API] Supabase 쿼리 완료");
    if (error) {
      console.error("[API] 보안등 조회 오류:", error);
      console.error("[API] 에러 상세:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json(
        { error: "보안등 정보를 불러오는데 실패했습니다.", details: error },
        { status: 500 }
      );
    }

    console.log(`[API] 조회 결과: ${data?.length || 0}개`);
    if (data && data.length > 0) {
      console.log(`[API] 첫 번째 데이터 샘플:`, data[0]);
      console.log(`[API] 데이터 좌표 범위:`, {
        minLatInData: Math.min(...data.map((d) => d.latitude)),
        maxLatInData: Math.max(...data.map((d) => d.latitude)),
        minLngInData: Math.min(...data.map((d) => d.longitude)),
        maxLngInData: Math.max(...data.map((d) => d.longitude)),
      });
    } else {
      console.warn(`[API] 조회 결과가 0개입니다.`);
      console.warn(
        `[API] 조회 영역: lat[${minLat.toFixed(6)}, ${maxLat.toFixed(
          6
        )}], lng[${minLng.toFixed(6)}, ${maxLng.toFixed(6)}]`
      );
      console.warn(
        `[API] 부산 지역 샘플 좌표(35.073, 128.839)가 이 범위에 포함되는지 확인하세요.`
      );

      // 범위가 너무 좁으면 테스트로 더 넓은 범위로 조회해보기
      if (maxLat - minLat < 0.1 || maxLng - minLng < 0.1) {
        console.log(
          "[API] 조회 영역이 좁아서 테스트로 부산 전체 지역 조회 시도..."
        );
        const { data: testData, error: testError } = await supabase
          .from("security_lights")
          .select("id, latitude, longitude")
          .gte("latitude", 35.0)
          .lte("latitude", 35.3)
          .gte("longitude", 128.8)
          .lte("longitude", 129.3)
          .not("latitude", "is", null)
          .not("longitude", "is", null)
          .limit(10);
        console.log(
          `[API] 부산 전체 지역 테스트 조회 결과: ${testData?.length || 0}개`,
          testError
        );
      }
    }

    return NextResponse.json({ securityLights: data || [] });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
