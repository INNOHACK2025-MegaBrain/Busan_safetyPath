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

    // RPC 호출 (Spatial Index 사용)
    console.log("[API] Supabase RPC(get_security_lights_in_bbox) 호출 시작");
    const { data, error } = await supabase.rpc("get_security_lights_in_bbox", {
      min_lat: minLat,
      min_lng: minLng,
      max_lat: maxLat,
      max_lng: maxLng,
    });

    console.log("[API] Supabase RPC 완료");
    if (error) {
      console.error("[API] 보안등 조회 오류 (RPC):", error);
      console.error("[API] 에러 상세:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
      // RPC가 없거나 실패할 경우 기존 방식(Lat/Lng 범위 검색)으로 폴백할 수도 있지만,
      // 여기서는 Spatial Index 사용을 위해 에러를 반환하고 마이그레이션 실행을 유도함.
      return NextResponse.json(
        {
          error: "보안등 정보를 불러오는데 실패했습니다. (공간 인덱스 필요)",
          details: error,
        },
        { status: 500 }
      );
    }

    console.log(`[API] 조회 결과: ${data?.length || 0}개`);

    return NextResponse.json({ securityLights: data || [] });
  } catch (error) {
    console.error("API 오류:", error);
    return NextResponse.json(
      { error: "서버 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
