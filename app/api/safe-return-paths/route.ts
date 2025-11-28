import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const swLat = searchParams.get("swLat");
    const swLng = searchParams.get("swLng");
    const neLat = searchParams.get("neLat");
    const neLng = searchParams.get("neLng");
    const debug = searchParams.get("debug");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let query = supabase
      .from("women_safe_return_paths")
      .select("*");

    // 범위 지정이 있는 경우 (일반적인 경우)
    if (swLat && swLng && neLat && neLng) {
      // 시작점이나 도착점 중 하나라도 범위 내에 있으면 가져옴
      // 주의: start_latitude, start_longitude 등의 컬럼 타입이 double precision인지 확인 필요
      query = query.or(`and(start_latitude.gte.${swLat},start_latitude.lte.${neLat},start_longitude.gte.${swLng},start_longitude.lte.${neLng}),and(end_latitude.gte.${swLat},end_latitude.lte.${neLat},end_longitude.gte.${swLng},end_longitude.lte.${neLng})`);
    } 
    // 디버그 모드인 경우 (전체 데이터 중 일부만)
    else if (debug === "true") {
      query = query.limit(100);
    } 
    // 범위가 없으면 빈 배열 반환 (부하 방지)
    else {
      return NextResponse.json({ paths: [] });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error (women_safe_return_paths):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // 디버깅용 로그
    if (debug === "true") {
        console.log(`[API] Fetched ${data?.length} safe return paths`);
    }

    return NextResponse.json({ paths: data });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
