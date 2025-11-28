import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const swLat = parseFloat(searchParams.get("swLat") || "0");
    const swLng = parseFloat(searchParams.get("swLng") || "0");
    const neLat = parseFloat(searchParams.get("neLat") || "0");
    const neLng = parseFloat(searchParams.get("neLng") || "0");
    const debug = searchParams.get("debug");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    let data = [];
    let error = null;

    // 범위 지정이 있는 경우 (RPC 사용)
    if (swLat && swLng && neLat && neLng) {
      const minLat = Math.min(swLat, neLat);
      const maxLat = Math.max(swLat, neLat);
      const minLng = Math.min(swLng, neLng);
      const maxLng = Math.max(swLng, neLng);

      const result = await supabase.rpc("get_emergency_bells_in_bbox", {
        min_lat: minLat,
        min_lng: minLng,
        max_lat: maxLat,
        max_lng: maxLng,
      });
      data = result.data;
      error = result.error;
    }
    // 디버그 모드인 경우
    else if (debug === "true") {
      const result = await supabase
        .from("safe_return_paths")
        .select("*")
        .limit(100);
      data = result.data;
      error = result.error;
    }
    // 범위가 없으면 빈 배열 반환
    else {
      return NextResponse.json({ bells: [] });
    }

    if (error) {
      console.error(
        "Supabase error (safe_return_paths - emergency bells):",
        error
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (debug === "true") {
      console.log(`[API] Fetched ${data?.length} emergency bells`);
    }

    return NextResponse.json({ bells: data || [] });
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
