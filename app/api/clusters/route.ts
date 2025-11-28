import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import Supercluster from "supercluster";

// Supercluster 인스턴스를 캐싱하기 위한 전역 변수
let clusterIndex: Supercluster | null = null;
let lastLoadedTime = 0;
let loadedPointCount = 0; // 로드된 포인트 개수 추적
const CACHE_DURATION = 1000 * 60 * 60; // 1시간

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const bboxStr = searchParams.get("bbox"); // minLng,minLat,maxLng,maxLat
    const zoomStr = searchParams.get("zoom");
    // type 파라미터는 이제 'all'이 기본값으로 처리되거나 무시될 수 있음 (통합 클러스터링)
    // 하지만 명시적으로 특정 타입만 요청하는 경우를 대비해 남겨둘 수 있음
    const type = searchParams.get("type") || "all";
    const force = searchParams.get("force") === "true"; // 강제 리로드 파라미터

    if (!bboxStr || !zoomStr) {
      return NextResponse.json(
        { error: "bbox and zoom parameters are required" },
        { status: 400 }
      );
    }

    const bbox = bboxStr.split(",").map(Number);
    const zoom = parseInt(zoomStr);

    if (bbox.length !== 4 || isNaN(zoom)) {
      return NextResponse.json(
        { error: "Invalid bbox or zoom parameter" },
        { status: 400 }
      );
    }

    // 인덱스 로드 또는 갱신
    const now = Date.now();
    if (
      !clusterIndex ||
      now - lastLoadedTime > CACHE_DURATION ||
      loadedPointCount < 5000 || // 데이터가 너무 적으면(부분 로드 의심) 다시 로드
      force
    ) {
      console.log(
        `[API] Loading data for clustering... (Reason: ${
          !clusterIndex
            ? "No Index"
            : force
            ? "Force"
            : loadedPointCount < 5000
            ? "Low Count (" + loadedPointCount + ")"
            : "Cache Expired"
        })`
      );

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const fetchTableData = async (
        tableName: string,
        itemType: string,
        latCol = "latitude",
        lngCol = "longitude"
      ) => {
        try {
          const { count } = await supabase
            .from(tableName)
            .select("*", { count: "exact", head: true });

          const totalCount = count || 0;
          if (totalCount === 0) return [];

          const pageSize = 10000;
          const totalPages = Math.ceil(totalCount / pageSize);

          console.log(`[API] Fetching ${totalCount} rows from ${tableName}...`);

          const promises = [];
          for (let i = 0; i < totalPages; i++) {
            promises.push(
              supabase
                .from(tableName)
                .select(`id, ${latCol}, ${lngCol}`)
                .range(i * pageSize, (i + 1) * pageSize - 1)
            );
          }

          const results = await Promise.all(promises);
          let tableData: any[] = [];
          results.forEach((result) => {
            if (result.data) {
              tableData = tableData.concat(result.data);
            }
          });

          return tableData
            .filter((item) => item[latCol] && item[lngCol])
            .map((item) => ({
              type: "Feature",
              properties: { cluster: false, id: item.id, type: itemType },
              geometry: {
                type: "Point",
                coordinates: [item[lngCol], item[latCol]],
              },
            }));
        } catch (err) {
          console.error(`Error fetching ${tableName}:`, err);
          return [];
        }
      };

      // 모든 데이터 병렬로 가져오기
      const [lights, cctvs, bells, safePaths] = await Promise.all([
        fetchTableData("security_lights", "security_lights"),
        fetchTableData("cctv_installations", "cctv"),
        fetchTableData("safe_return_paths", "bells"),
        fetchTableData(
          "women_safe_return_paths",
          "safe_paths",
          "start_latitude",
          "start_longitude"
        ), // 안심귀갓길은 시작점 기준
      ]);

      const allPoints = [...lights, ...cctvs, ...bells, ...safePaths];

      if (allPoints.length === 0) {
        return NextResponse.json([]);
      }

      // Supercluster 초기화 (옵션 조정)
      clusterIndex = new Supercluster({
        radius: 60, // 클러스터링 반경
        maxZoom: 18,
        minPoints: 2,
      });

      clusterIndex.load(allPoints as any);
      lastLoadedTime = now;
      loadedPointCount = allPoints.length; // 로드된 개수 저장
      console.log(
        `[API] Loaded total ${allPoints.length} points into cluster index (Lights: ${lights.length}, CCTV: ${cctvs.length}, Bells: ${bells.length}, Paths: ${safePaths.length})`
      );
    }

    // 클러스터 조회
    const clusters = clusterIndex.getClusters(
      [bbox[0], bbox[1], bbox[2], bbox[3]],
      zoom
    );

    return NextResponse.json(clusters);
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
