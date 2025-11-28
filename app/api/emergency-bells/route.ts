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
      .from("safe_return_paths") // 비상벨 테이블
      .select("*");

    // 범위 지정이 있는 경우
    if (swLat && swLng && neLat && neLng) {
      query = query
        .gte("latitude", swLat)
        .lte("latitude", neLat)
        .gte("longitude", swLng)
        .lte("longitude", neLng);
    } 
    // 디버그 모드인 경우
    else if (debug === "true") {
      query = query.limit(100);
    } 
    // 범위가 없으면 빈 배열 반환
    else {
      return NextResponse.json({ bells: [] });
    }

    const { data, error } = await query;

    if (error) {
      console.error("Supabase error (safe_return_paths - emergency bells):", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    if (debug === "true") {
        console.log(`[API] Fetched ${data?.length} emergency bells`);
    }

    return NextResponse.json({ bells: data });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

