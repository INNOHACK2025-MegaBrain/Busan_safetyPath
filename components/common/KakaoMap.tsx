"use client";

import { Map, Polyline, CustomOverlayMap } from "react-kakao-maps-sdk";
import useKakaoLoader from "@/hooks/useKakaoLoader";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import AddMapCustomControlStyle from "./addMapCustomControl.style";
import { MapMarker } from "react-kakao-maps-sdk";
import {
  Navigation,
  MapPin,
  X,
  Map as MapIcon,
  Satellite,
  Layers,
  Grid3x3,
} from "lucide-react";
import { useMapStore } from "@/store/mapStore";
import { useUIStore } from "@/store/uiStore";
import { Toggle } from "@/components/ui/toggle";
import HeatmapLayer from "./HeatmapLayer";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

// 클러스터 데이터 타입 정의
interface ClusterProperties {
  cluster: boolean;
  id?: string; // 클러스터가 아닐 때
  point_count?: number; // 클러스터일 때
  [key: string]: unknown;
}

interface ClusterGeometry {
  type: "Point";
  coordinates: [number, number];
}

interface ClusterFeature {
  type: "Feature";
  id?: number | string;
  properties: ClusterProperties;
  geometry: ClusterGeometry;
}

export default function BasicMap() {
  useKakaoLoader();
  const mapRef = useRef<kakao.maps.Map>(null);
  const [mapType, setMapType] = useState<"roadmap" | "skyview">("roadmap");
  const [mapInstance, setMapInstance] = useState<kakao.maps.Map | null>(null);
  const [visualizationMode, setVisualizationMode] = useState<
    "none" | "cluster" | "heatmap"
  >("none"); // 기본값은 none 유지
  const [followTargetId, setFollowTargetId] = useState<string | null>(null);

  // mapStore에서 center와 destinationInfo, routePath, currentPosition 가져오기
  const {
    center,
    setCenter,
    destinationInfo,
    routePath,
    currentPosition,
    setCurrentPosition,
    showDestinationOverlay,
    setShowDestinationOverlay,
    securityLights,
    setSecurityLights,
    safeReturnPaths,
    setSafeReturnPaths,
    emergencyBells,
    setEmergencyBells,
    cctvs,
    setCctvs,
    setLevel,
    sosTargets,
    setSosTargets,
  } = useMapStore();
  const { openModal } = useUIStore();
  const [loading, setLoading] = useState(true);
  const hasCheckedDebug = useRef(false);

  // 이전 요청 취소를 위한 AbortController (컴포넌트 최상위로 이동)
  const abortControllerRef = useRef<AbortController | null>(null);
  const pathAbortControllerRef = useRef<AbortController | null>(null); // 여성 안심 귀갓길용
  const bellAbortControllerRef = useRef<AbortController | null>(null); // 비상벨용
  const cctvAbortControllerRef = useRef<AbortController | null>(null); // CCTV용
  // 마지막 조회 영역 저장 (중복 요청 방지)
  const lastBoundsRef = useRef<{
    swLat: number;
    swLng: number;
    neLat: number;
    neLng: number;
  } | null>(null);

  // 1. 경로 생성: routePath가 있을 때만 경로 표시
  const path = useMemo(() => {
    // 계산된 경로가 있으면 사용
    if (routePath && routePath.length > 0) {
      return routePath;
    }

    // routePath가 없으면 경로 표시 안 함
    return [];
  }, [routePath]);

  const incomingTargets = useMemo(
    () => sosTargets.filter((target) => !target.triggeredByMe),
    [sosTargets]
  );
  const outgoingTargets = useMemo(
    () => sosTargets.filter((target) => target.triggeredByMe),
    [sosTargets]
  );

  const primaryIncomingTarget = useMemo(() => {
    if (followTargetId) {
      return (
        incomingTargets.find((target) => target.id === followTargetId) || null
      );
    }
    return incomingTargets[0] || null;
  }, [followTargetId, incomingTargets]);

  const centerOnTarget = useCallback(
    (target?: (typeof sosTargets)[number] | null) => {
      if (!target) return;
      if (
        typeof target.latitude !== "number" ||
        typeof target.longitude !== "number" ||
        Number.isNaN(target.latitude) ||
        Number.isNaN(target.longitude)
      ) {
        return;
      }
      setCenter({ lat: target.latitude, lng: target.longitude });
    },
    [setCenter]
  );

  useEffect(() => {
    centerOnTarget(primaryIncomingTarget);
  }, [centerOnTarget, primaryIncomingTarget]);

  const handleFollowTarget = useCallback(
    (target?: (typeof sosTargets)[number] | null) => {
      if (!target) return;
      setFollowTargetId(target.id);
      centerOnTarget(target);
    },
    [centerOnTarget]
  );

  const getDisplayName = useCallback(
    (target?: (typeof sosTargets)[number] | null) => {
      if (!target) return "보호자";
      return target.partnerName || target.partnerEmail || "보호자";
    },
    []
  );

  const outgoingStatusLabel = useMemo(() => {
    if (outgoingTargets.length === 0) {
      return "";
    }

    const primary = outgoingTargets[0];
    const name = getDisplayName(primary);

    if (outgoingTargets.length === 1) {
      return `${name} 님에게 위치가 공유중입니다.`;
    }

    return `${name} 님 외 ${
      outgoingTargets.length - 1
    }명에게 위치가 공유중입니다.`;
  }, [getDisplayName, outgoingTargets]);

  useEffect(() => {
    // 현재 위치가 이미 있으면 로딩 완료
    if (currentPosition) {
      queueMicrotask(() => {
        setLoading(false);
      });
      return;
    }

    // 현재 위치 가져오기
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setCurrentPosition(newPosition);
          setCenter(newPosition);
          setLoading(false);
        },
        (error) => {
          console.error("위치 정보를 가져올 수 없습니다:", error);
          const fallbackPosition = {
            lat: center.lat,
            lng: center.lng,
          };
          setCurrentPosition(fallbackPosition);
          setLoading(false);
        }
      );
    } else {
      console.error("Geolocation을 지원하지 않는 브라우저입니다.");
      queueMicrotask(() => {
        const fallbackPosition = {
          lat: center.lat,
          lng: center.lng,
        };
        setCurrentPosition(fallbackPosition);
        setLoading(false);
      });
    }
  }, [center, setCenter, currentPosition, setCurrentPosition]);

  // mapStore의 center가 변경될 때 지도 이동
  useEffect(() => {
    const map = mapInstance || mapRef.current;
    if (!map) return;

    const moveLatLon = new kakao.maps.LatLng(center.lat, center.lng);
    map.setCenter(moveLatLon);
  }, [center, mapInstance]); // mapInstance 의존성 추가

  // 지도 영역 변경 시 보안등 데이터 가져오기
  useEffect(() => {
    const map = mapInstance || mapRef.current;
    if (!map || loading) {
      return;
    }

    // useEffect 내부에서는 useRef를 호출하지 않고, 이미 선언된 ref 사용
    const fetchSecurityLights = async () => {
      try {
        const bounds = map.getBounds();
        if (!bounds) {
          return;
        }

        const swLatLng = bounds.getSouthWest();
        const neLatLng = bounds.getNorthEast();
        const swLat = swLatLng.getLat();
        const swLng = swLatLng.getLng();
        const neLat = neLatLng.getLat();
        const neLng = neLatLng.getLng();

        // 이전 조회 영역과 비교
        const lastBounds = lastBoundsRef.current;
        if (lastBounds) {
          const latDiff =
            Math.abs(neLat - lastBounds.neLat) +
            Math.abs(swLat - lastBounds.swLat);
          const lngDiff =
            Math.abs(neLng - lastBounds.neLng) +
            Math.abs(swLng - lastBounds.swLng);

          // 영역이 크게 변하지 않았으면 요청하지 않음 (0.01도 = 약 1km)
          if (latDiff < 0.01 && lngDiff < 0.01) {
            console.log("[지도] 영역 변경이 작아서 요청 생략");
            return;
          }
        }

        // 이전 요청이 있으면 취소
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        // 새로운 AbortController 생성
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        // 조회 영역 저장
        lastBoundsRef.current = { swLat, swLng, neLat, neLng };

        // 디버그 모드로 전체 데이터 확인 (첫 로드 시에만)
        if (!hasCheckedDebug.current) {
          hasCheckedDebug.current = true;
          if (process.env.NODE_ENV === "development") {
            try {
              const debugResponse = await fetch(
                `/api/security-lights?debug=true`
              );
              if (debugResponse.ok) {
                const debugData = await debugResponse.json();
                console.log("[지도] 보안등 데이터 확인:", debugData);
              }

              const debugPathResponse = await fetch(
                `/api/safe-return-paths?debug=true`
              );
              if (debugPathResponse.ok) {
                const debugPathData = await debugPathResponse.json();
                console.log("[지도] 안심 귀갓길 데이터 확인:", debugPathData);
              }

              const debugBellResponse = await fetch(
                `/api/emergency-bells?debug=true`
              );
              if (debugBellResponse.ok) {
                const debugBellData = await debugBellResponse.json();
                console.log("[지도] 비상벨 데이터 확인:", debugBellData);
              }

              const debugCctvResponse = await fetch(`/api/cctv?debug=true`);
              if (debugCctvResponse.ok) {
                const debugCctvData = await debugCctvResponse.json();
                console.log("[지도] CCTV 데이터 확인:", debugCctvData);
              }
            } catch (debugError) {
              console.error("[지도] 디버그 API 호출 실패:", debugError);
            }
          }
        }

        const response = await fetch(
          `/api/security-lights?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`,
          { signal: abortController.signal }
        );

        // 여성 안심 귀갓길 데이터 가져오기
        if (pathAbortControllerRef.current) {
          pathAbortControllerRef.current.abort();
        }
        const pathAbortController = new AbortController();
        pathAbortControllerRef.current = pathAbortController;

        // 비상벨 데이터 가져오기
        if (bellAbortControllerRef.current) {
          bellAbortControllerRef.current.abort();
        }
        const bellAbortController = new AbortController();
        bellAbortControllerRef.current = bellAbortController;

        // CCTV 데이터 가져오기
        if (cctvAbortControllerRef.current) {
          cctvAbortControllerRef.current.abort();
        }
        const cctvAbortController = new AbortController();
        cctvAbortControllerRef.current = cctvAbortController;

        const pathResponse = await fetch(
          `/api/safe-return-paths?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`,
          { signal: pathAbortController.signal }
        );

        const bellResponse = await fetch(
          `/api/emergency-bells?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`,
          { signal: bellAbortController.signal }
        );

        const cctvResponse = await fetch(
          `/api/cctv?swLat=${swLat}&swLng=${swLng}&neLat=${neLat}&neLng=${neLng}`,
          { signal: cctvAbortController.signal }
        );

        // 요청이 취소되었으면 처리하지 않음
        if (abortController.signal.aborted) {
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const lights = data.securityLights || [];

          if (lights.length > 0) {
            // 좌표 유효성 검사
            const validLights = lights.filter(
              (light: { latitude?: number; longitude?: number }) =>
                light.latitude &&
                light.longitude &&
                typeof light.latitude === "number" &&
                typeof light.longitude === "number" &&
                !isNaN(light.latitude) &&
                !isNaN(light.longitude)
            );
            setSecurityLights(validLights);
          } else {
            setSecurityLights([]);
          }
        }

        if (pathResponse.ok) {
          const pathData = await pathResponse.json();
          setSafeReturnPaths(pathData.paths || []);
        }

        if (bellResponse.ok) {
          const bellData = await bellResponse.json();
          setEmergencyBells(bellData.bells || []);
        }

        if (cctvResponse.ok) {
          const cctvData = await cctvResponse.json();
          setCctvs(cctvData.cctvs || []);
        }
      } catch (error) {
        // AbortError는 무시 (의도적인 취소)
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }
        console.error("[지도] 데이터 가져오기 실패:", error);
      }
    };

    // 지도 이동 완료 시 보안등 데이터 가져오기 (idle 이벤트는 이미 debounce됨)
    const handleIdle = () => {
      fetchSecurityLights();
    };

    // 지도 로드 완료 후 이벤트 리스너 추가
    const handleLoad = () => {
      const bounds = map.getBounds();
      if (bounds) {
        kakao.maps.event.addListener(map, "idle", handleIdle);
        // 초기 로드 시 한 번 실행
        fetchSecurityLights();
      }
    };

    kakao.maps.event.addListener(map, "tilesloaded", handleLoad);

    // 지도가 이미 로드된 경우를 대비해 직접 호출 시도
    const tryFetch = () => {
      const bounds = map.getBounds();
      if (bounds) {
        fetchSecurityLights();
        // 중복 등록 방지를 위해 기존 리스너 제거 시도 후 추가는 handleLoad에서 처리하지만
        // 여기서는 바로 idle 리스너를 붙이는게 안전함
        kakao.maps.event.removeListener(map, "idle", handleIdle);
        kakao.maps.event.addListener(map, "idle", handleIdle);
      } else {
        setTimeout(tryFetch, 500);
      }
    };

    setTimeout(tryFetch, 100);

    return () => {
      // cleanup 시 진행 중인 요청 취소
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (pathAbortControllerRef.current) {
        pathAbortControllerRef.current.abort();
      }
      if (bellAbortControllerRef.current) {
        bellAbortControllerRef.current.abort();
      }
      if (cctvAbortControllerRef.current) {
        cctvAbortControllerRef.current.abort();
      }
      kakao.maps.event.removeListener(map, "tilesloaded", handleLoad);
      kakao.maps.event.removeListener(map, "idle", handleIdle);
    };
  }, [
    setSecurityLights,
    setSafeReturnPaths,
    setEmergencyBells,
    setCctvs,
    loading,
    mapInstance,
  ]);

  useEffect(() => {
    let isMounted = true;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const fetchActiveSos = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          if (isMounted) {
            setSosTargets([]);
          }
          return;
        }

        const response = await fetch("/api/guardians/active-sos", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401 && isMounted) {
            setSosTargets([]);
          }
          return;
        }

        const data = await response.json();
        if (!isMounted) return;
        setSosTargets(data.sessions || []);
      } catch (error) {
        if (process.env.NODE_ENV === "development") {
          console.error("[지도] 보호자 SOS 조회 실패:", error);
        }
      }
    };

    fetchActiveSos();
    pollTimer = setInterval(fetchActiveSos, 10_000);

    return () => {
      isMounted = false;
      if (pollTimer) {
        clearInterval(pollTimer);
      }
    };
  }, [setSosTargets]);

  const notifyIncomingSos = useCallback(
    (target: (typeof sosTargets)[number]) => {
      const displayName = target.partnerName || target.partnerEmail || "보호자";
      const message = `${displayName} 님이 SOS 위치를 공유 중입니다.`;

      const showToast = () =>
        toast.warning(message, {
          description: "지도를 열어 현재 위치를 확인하세요.",
          duration: 6000,
        });

      if (typeof window === "undefined" || !("Notification" in window)) {
        showToast();
        return;
      }

      const sendBrowserNotification = () => {
        try {
          new Notification("SOS 알림", {
            body: message,
            icon: "/icons/sos.png",
            tag: `sos-${target.id}`,
          });
        } catch (error) {
          if (process.env.NODE_ENV === "development") {
            console.error("[지도] Notification 생성 실패", error);
          }
          showToast();
        }
      };

      if (Notification.permission === "granted") {
        sendBrowserNotification();
        return;
      }

      if (Notification.permission === "default") {
        Notification.requestPermission()
          .then((permission) => {
            if (permission === "granted") {
              sendBrowserNotification();
            } else {
              showToast();
            }
          })
          .catch(() => {
            showToast();
          });
        return;
      }

      showToast();
    },
    []
  );

  const previousSosIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const prevIds = previousSosIdsRef.current;
    const currentIds = new Set<string>();

    sosTargets.forEach((target) => {
      currentIds.add(target.id);
      if (!target.triggeredByMe && !prevIds.has(target.id)) {
        notifyIncomingSos(target);
      }
    });

    previousSosIdsRef.current = currentIds;
  }, [notifyIncomingSos, sosTargets]);

  // 5. [서버 사이드 클러스터링 요청]
  // mapStore에 클러스터 데이터를 저장할 state 추가 필요 (현재는 로컬 state 사용)
  const [serverClusters, setServerClusters] = useState<ClusterFeature[]>([]);

  useEffect(() => {
    const map = mapInstance || mapRef.current;
    // 클러스터 모드가 아니거나 맵이 없으면 중단
    if (!map || visualizationMode !== "cluster") return;

    const fetchClusters = async () => {
      const bounds = map.getBounds();
      if (!bounds) return;

      const sw = bounds.getSouthWest();
      const ne = bounds.getNorthEast();
      const zoom = map.getLevel(); // 카카오맵 줌 레벨 (낮을수록 확대)
      // Supercluster는 줌 레벨이 높을수록 확대 (0~24).
      // 카카오맵 레벨 1(최대 확대) ~= 구글 줌 18
      // 카카오맵 레벨 14(최대 축소) ~= 구글 줌 5
      // 변환 공식: 19 - zoom (대략적)
      const clusterZoom = Math.max(0, 19 - zoom);

      // 사용자가 지적한 문제: "bbox가 현재 저 왼쪽으로 고정되어있어서 그런거 아니야?"
      // 해결: bbox를 현재 보고 있는 지도 영역이 아니라, '전체 영역'으로 요청하거나
      // 혹은 사용자가 이동할 때마다 bbox를 갱신해서 가져와야 함.
      // 현재 로직은 map.getBounds()를 사용하므로, 지도 이동 시마다 fetchClusters가 호출되어야 정상.
      // 하지만 초기 로딩이나 특정 상황에서 bbox가 잘못 계산되거나,
      // 전체 데이터를 보고 싶은데 현재 뷰포트만 가져오는 것이 문제일 수 있음.
      //
      // 만약 "전체 데이터를 클러스터링해서 보고 싶다"는 의도라면,
      // 서버에서는 이미 전체 데이터를 로드하고 있으므로,
      // 클라이언트에서 요청하는 bbox를 '대한민국 전체' 또는 '부산시 전체'로 넓게 잡아서 요청하는 것이 방법일 수 있음.
      // 하지만 효율성을 위해 뷰포트 기반(bbox)으로 가져오는 것이 맞음.

      // 사용자가 "왼쪽 부분만 렌더링 된다"고 한 것은
      // 아마도 초기 로딩 시 map.getBounds()가 아직 설정되지 않았거나
      // 초기 위치가 치우쳐져 있어서 그 부분만 가져왔고,
      // 이후 이동 시 재요청이 제대로 안 되었을 가능성이 있음.

      // 따라서, 여기서는 bbox를 현재 뷰포트보다 훨씬 넓게(buffer) 잡아서 요청하도록 수정.
      // 현재 뷰포트의 2배 정도 넓게 잡아서 주변 데이터도 미리 가져오도록 함.

      const latBuffer = (ne.getLat() - sw.getLat()) * 1.0; // 위아래로 1배 더
      const lngBuffer = (ne.getLng() - sw.getLng()) * 1.0; // 좌우로 1배 더

      const expandedSwLat = sw.getLat() - latBuffer;
      const expandedSwLng = sw.getLng() - lngBuffer;
      const expandedNeLat = ne.getLat() + latBuffer;
      const expandedNeLng = ne.getLng() + lngBuffer;

      const bbox = `${expandedSwLng},${expandedSwLat},${expandedNeLng},${expandedNeLat}`;

      console.log(
        `[Cluster] Fetching for zoom: ${zoom} -> ${clusterZoom}, bbox: ${bbox} (Expanded)`
      );

      try {
        // 보안등, 안심귀갓길, 비상벨, CCTV 통합 클러스터 요청 (type=all)
        const res = await fetch(
          `/api/clusters?bbox=${bbox}&zoom=${clusterZoom}&type=all&force=true`
        );
        if (res.ok) {
          const clusters = await res.json();
          console.log(`[Cluster] Received ${clusters.length} clusters`);
          setServerClusters(clusters);
        } else {
          console.error("[Cluster] API Error:", res.status, await res.text());
        }
      } catch (e) {
        console.error("Failed to fetch clusters", e);
      }
    };

    // 디바운스 또는 idle 이벤트에 연결
    kakao.maps.event.addListener(map, "idle", fetchClusters);
    fetchClusters(); // 초기 실행

    return () => {
      kakao.maps.event.removeListener(map, "idle", fetchClusters);
    };
  }, [mapInstance, visualizationMode]);

  // 6. [서버 클러스터 렌더링]
  const renderServerClusters = () => {
    // 아이콘 SVG Data URI (원형 배경 포함)
    const lightIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23EAB308%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23EAB308%22%20stroke%3D%22%23EAB308%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M15%2014c.2-1%20.7-1.7%201.5-2.5%201-1%201.5-2%201.5-3.5A6%206%200%200%200%206%208c0%201%20.5%202%201.5%203.5.8.8%201.3%201.5%201.5%201.5%202.5%22%2F%3E%3Cpath%20d%3D%22M9%2018h6%22%2F%3E%3Cpath%20d%3D%22M10%2022h4%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E";

    const bellIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23EF4444%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23EF4444%22%20stroke%3D%22%23EF4444%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%208a6%206%200%200%201%2012%200c0%207%203%209%203%209H3s3-2%203-9%22%2F%3E%3Cpath%20d%3D%22M10.3%2021a1.94%201.94%200%200%200%203.4%200%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E";

    const footprintIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%233B82F6%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%233B82F6%22%20stroke%3D%22%233B82F6%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M19%2014c1.49-1.46%203-3.21%203-5.5A5.5%205.5%200%200%200%2016.5%203c-1.76%200-3%20.5-4.5%202-1.5-1.5-2.74-2-4.5-2A5.5%205.5%200%200%200%202%208.5c0%202.3%201.5%204.05%203%205.5l7%207Z%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E";

    const cctvIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23A855F7%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23A855F7%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M16.75%2012h3.632a1%201%200%200%201%20.894%201.447l-2.034%204.069a1%201%200%200%201-1.708.134l-2.124-2.97%22%2F%3E%3Cpath%20d%3D%22M17.106%209.053a1%201%200%200%201%20.447%201.341l-3.106%206.211a1%201%200%200%201-1.342.447L3.61%2012.3a2.92%202.92%200%200%201-1.3-3.91L3.69%205.6a2.92%202.92%200%200%201%203.92-1.3z%22%2F%3E%3Cpath%20d%3D%22M2%2019h3.76a2%202%200%200%200%201.8-1.1L9%2015%22%2F%3E%3Cpath%20d%3D%22M2%2021v-4%22%2F%3E%3Cpath%20d%3D%22M7%209h.01%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E";

    if (!serverClusters || serverClusters.length === 0) {
      return null;
    }

    return serverClusters.map((cluster) => {
      const [lng, lat] = cluster.geometry.coordinates;
      const isCluster = cluster.properties.cluster;
      const pointCount = cluster.properties.point_count;

      // 클러스터 크기에 따른 스타일 (MarkerClusterer와 유사하게)
      let size = 40;
      let color = "rgba(245, 158, 11, 0.8)"; // 주황 (기본)

      if (isCluster && pointCount) {
        if (pointCount < 10) {
          size = 30;
          color = "rgba(59, 130, 246, 0.8)"; // 파랑
        } else if (pointCount >= 50) {
          size = 50;
          color = "rgba(239, 68, 68, 0.8)"; // 빨강
        }
      }

      if (isCluster) {
        // 클러스터 마커
        return (
          <CustomOverlayMap
            key={`cluster-${cluster.id}`}
            position={{ lat, lng }}
            zIndex={10}
          >
            <div
              style={{
                width: `${size}px`,
                height: `${size}px`,
                background: color,
                borderRadius: "50%",
                color: "#fff",
                textAlign: "center",
                lineHeight: `${size}px`,
                fontWeight: "bold",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                border: "2px solid white",
                cursor: "pointer",
              }}
              onClick={() => {
                // 클러스터 클릭 시 확대 (Supercluster의 getClusterExpansionZoom 사용 가능하지만 API 호출 필요)
                // 여기서는 간단히 2단계 확대
                if (mapInstance) {
                  mapInstance.setLevel(mapInstance.getLevel() - 2);
                  mapInstance.panTo(new kakao.maps.LatLng(lat, lng));
                }
              }}
            >
              {pointCount}
            </div>
          </CustomOverlayMap>
        );
      } else {
        // 단일 마커 (타입별 아이콘 적용)
        const type = cluster.properties.type;
        let iconSrc = lightIcon;
        let title = "보안등";

        if (type === "bells") {
          iconSrc = bellIcon;
          title = "비상벨";
        } else if (type === "cctv") {
          iconSrc = cctvIcon;
          title = "CCTV";
        } else if (type === "safe_paths") {
          iconSrc = footprintIcon;
          title = "안심 귀갓길";
        }

        return (
          <MapMarker
            key={`point-${type}-${cluster.properties.id}`}
            position={{ lat, lng }}
            image={{
              src: iconSrc,
              size: { width: 32, height: 32 },
            }}
            title={title}
          />
        );
      }
    });
  };

  const renderSosMarkers = () => {
    if (!sosTargets || sosTargets.length === 0) {
      return null;
    }

    const sosIcon =
      "data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2240%22%20height%3D%2240%22%20viewBox%3D%220%200%2040%2040%22%3E%3Ccircle%20cx%3D%2220%22%20cy%3D%2220%22%20r%3D%2218%22%20fill%3D%22white%22%20stroke%3D%22%23DC2626%22%20stroke-width%3D%223%22%2F%3E%3Ctext%20x%3D%2220%22%20y%3D%2225%22%20text-anchor%3D%22middle%22%20font-size%3D%2212%22%20font-family%3D%22Arial%22%20font-weight%3D%22bold%22%20fill%3D%22%23DC2626%22%3ESOS%3C%2Ftext%3E%3C%2Fsvg%3E";

    const elements: JSX.Element[] = [];

    sosTargets
      .filter((target) => !target.triggeredByMe)
      .forEach((target) => {
        if (
          typeof target.latitude !== "number" ||
          typeof target.longitude !== "number" ||
          Number.isNaN(target.latitude) ||
          Number.isNaN(target.longitude)
        ) {
          return;
        }

        const markerKey = `sos-${target.id}`;
        const labelKey = `sos-label-${target.id}`;
        const name = target.partnerName || target.partnerEmail;

        elements.push(
          <MapMarker
            key={markerKey}
            position={{ lat: target.latitude, lng: target.longitude }}
            title={`${name} SOS 위치`}
            image={{
              src: sosIcon,
              size: { width: 44, height: 44 },
            }}
          />
        );

        elements.push(
          <CustomOverlayMap
            key={labelKey}
            position={{ lat: target.latitude, lng: target.longitude }}
          >
            <div className="bg-destructive text-destructive-foreground text-xs font-semibold px-2 py-1 rounded-full shadow-lg">
              {name} 위치 공유 중
            </div>
          </CustomOverlayMap>
        );
      });

    return elements;
  };

  if (loading) {
    return (
      <div className="w-full h-[350px] flex items-center justify-center bg-gray-100">
        <p>위치 정보를 가져오는 중...</p>
      </div>
    );
  }
  return (
    <>
      <AddMapCustomControlStyle />
      <div className={`map_wrap`}>
        <Map
          id="map"
          center={{
            lat: center.lat,
            lng: center.lng,
          }}
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            overflow: "hidden",
          }}
          level={3}
          mapTypeId={mapType === "roadmap" ? "ROADMAP" : "HYBRID"}
          ref={mapRef}
          onCreate={(map) => {
            console.log("[지도] onCreate 콜백 호출됨, 지도 인스턴스 받음");
            setMapInstance(map);
          }}
          onZoomChanged={(map) => {
            setCenter({
              lat: map.getCenter().getLat(),
              lng: map.getCenter().getLng(),
            });
            setLevel(map.getLevel());
          }}
        >
          {!!currentPosition && (
            <CustomOverlayMap position={currentPosition}>
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-primary/20 animate-ping absolute inset-0" />
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center relative">
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                    <Navigation className="h-3 w-3 text-primary-foreground" />
                  </div>
                </div>
              </div>
            </CustomOverlayMap>
          )}
          {/* 2. 최적 경로 Polyline (안심길 - 초록색) */}
          {path.length > 0 && (
            <Polyline
              path={path} // 현재 위치를 시작으로 하는 전체 경로
              strokeWeight={6}
              strokeColor={"#00FF00"} // 안심길 경로 색상을 초록색으로 변경
              strokeOpacity={0.8}
              strokeStyle={"solid"}
              endArrow={true}
            />
          )}

          {/* 4. [JSX 조건부 렌더링] - 마커와 클러스터는 여기서 처리 */}

          {/* none 모드일 때는 아무것도 렌더링하지 않음 */}

          {/* 클러스터 모드 (서버 사이드 클러스터링) */}
          {visualizationMode === "cluster" && <>{renderServerClusters()}</>}

          {renderSosMarkers()}

          {/* 히트맵 모드 */}
          {visualizationMode === "heatmap" &&
            (securityLights.length > 0 ||
              safeReturnPaths.length > 0 ||
              emergencyBells.length > 0 ||
              cctvs.length > 0) && (
              <HeatmapLayer
                data={securityLights}
                safeReturnPaths={safeReturnPaths}
                emergencyBells={emergencyBells}
                cctvs={cctvs}
              />
            )}

          {/* 4. 검색한 목적지 마커 */}
          {destinationInfo && (
            <>
              <MapMarker
                position={destinationInfo.coord}
                onClick={() => {
                  setShowDestinationOverlay(true);
                  openModal("route");
                }}
              />
              {showDestinationOverlay && (
                <CustomOverlayMap
                  position={destinationInfo.coord}
                  yAnchor={1.5}
                >
                  <div className="bg-background border border-border rounded-lg shadow-lg p-4 min-w-[200px] max-w-[300px]">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary shrink-0" />
                        <h3 className="font-semibold text-foreground text-sm">
                          {destinationInfo.place_name}
                        </h3>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDestinationOverlay(false);
                        }}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-1 text-xs text-muted-foreground">
                      {destinationInfo.road_address_name && (
                        <p className="flex items-start gap-1">
                          <span className="font-medium">도로명:</span>
                          <span>{destinationInfo.road_address_name}</span>
                        </p>
                      )}
                      <p className="flex items-start gap-1">
                        <span className="font-medium">지번:</span>
                        <span>{destinationInfo.address_name}</span>
                      </p>
                    </div>
                  </div>
                </CustomOverlayMap>
              )}
            </>
          )}
        </Map>
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[1000] flex max-w-[90%] -translate-x-1/2 flex-col items-center gap-2">
          {primaryIncomingTarget && (
            <button
              type="button"
              onClick={() => handleFollowTarget(primaryIncomingTarget)}
              className="pointer-events-auto w-full rounded-2xl bg-destructive px-5 py-3 text-sm font-medium text-destructive-foreground shadow-lg"
            >
              <span className="font-semibold">
                {getDisplayName(primaryIncomingTarget)}
              </span>{" "}
              님에게 SOS 호출을 받았습니다.
              <br />
              클릭하여 위치를 확인하세요.
            </button>
          )}
          {outgoingStatusLabel && (
            <div className="pointer-events-none w-full rounded-2xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg">
              {outgoingStatusLabel}
            </div>
          )}
        </div>
        {/* 시각화 모드 전환 토글 */}
        <div className="absolute top-4 left-4 z-10">
          <div className="flex flex-col gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
            <Toggle
              pressed={visualizationMode === "none"}
              onPressedChange={(pressed) => {
                if (pressed) {
                  setVisualizationMode("none");
                  if (mapInstance && currentPosition) {
                    const moveLatLon = new kakao.maps.LatLng(
                      currentPosition.lat,
                      currentPosition.lng
                    );
                    mapInstance.panTo(moveLatLon);
                    mapInstance.setLevel(3); // 지도만 볼 때는 더 자세히 (3레벨)
                  }
                }
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-full justify-start"
              aria-label="지도만 보기"
            >
              <MapIcon className="h-3 w-3 mr-1" />
              <span className="text-xs">지도만</span>
            </Toggle>
            <Toggle
              pressed={visualizationMode === "cluster"}
              onPressedChange={(pressed) => {
                if (pressed) {
                  setVisualizationMode("cluster");
                  if (mapInstance && currentPosition) {
                    const moveLatLon = new kakao.maps.LatLng(
                      currentPosition.lat,
                      currentPosition.lng
                    );
                    mapInstance.panTo(moveLatLon);
                    mapInstance.setLevel(8);
                  }
                } else {
                  // 토글 해제 시 클러스터 인스턴스를 삭제(리셋)하기 위해 모드 변경
                  setVisualizationMode("none");
                }
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-full justify-start"
              aria-label="클러스터 모드"
            >
              <Layers className="h-3 w-3 mr-1" />
              <span className="text-xs">클러스터</span>
            </Toggle>
            <Toggle
              pressed={visualizationMode === "heatmap"}
              onPressedChange={(pressed) => {
                if (pressed) {
                  setVisualizationMode("heatmap");
                  if (mapInstance && currentPosition) {
                    const moveLatLon = new kakao.maps.LatLng(
                      currentPosition.lat,
                      currentPosition.lng
                    );
                    mapInstance.panTo(moveLatLon);
                    mapInstance.setLevel(3); // 히트맵도 자세히 보기 위해 레벨 3으로 변경
                  }
                } else {
                  setVisualizationMode("none");
                }
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground w-full justify-start"
              aria-label="히트맵 모드"
            >
              <Grid3x3 className="h-3 w-3 mr-1" />
              <span className="text-xs">히트맵</span>
            </Toggle>
          </div>
          {/* 범례 (Legend) */}
          <div className="mt-2 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-2 shadow-lg space-y-2">
            <div className="flex items-center gap-2">
              <img
                src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23EAB308%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23EAB308%22%20stroke%3D%22%23EAB308%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M15%2014c.2-1%20.7-1.7%201.5-2.5%201-1%201.5-2%201.5-3.5A6%206%200%200%200%206%208c0%201%20.5%202%201.5%203.5.8.8%201.3%201.5%201.5%201.5%202.5%22%2F%3E%3Cpath%20d%3D%22M9%2018h6%22%2F%3E%3Cpath%20d%3D%22M10%2022h4%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E"
                alt="보안등"
                className="w-4 h-4"
              />
              <span className="text-xs font-medium">보안등</span>
            </div>
            <div className="flex items-center gap-2">
              <img
                src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23A855F7%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23A855F7%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M16.75%2012h3.632a1%201%200%200%201%20.894%201.447l-2.034%204.069a1%201%200%200%201-1.708.134l-2.124-2.97%22%2F%3E%3Cpath%20d%3D%22M17.106%209.053a1%201%200%200%201%20.447%201.341l-3.106%206.211a1%201%200%200%201-1.342.447L3.61%2012.3a2.92%202.92%200%200%201-1.3-3.91L3.69%205.6a2.92%202.92%200%200%201%203.92-1.3z%22%2F%3E%3Cpath%20d%3D%22M2%2019h3.76a2%202%200%200%200%201.8-1.1L9%2015%22%2F%3E%3Cpath%20d%3D%22M2%2021v-4%22%2F%3E%3Cpath%20d%3D%22M7%209h.01%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E"
                alt="CCTV"
                className="w-4 h-4"
              />
              <span className="text-xs font-medium">CCTV</span>
            </div>
            <div className="flex items-center gap-2">
              <img
                src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%23EF4444%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%23EF4444%22%20stroke%3D%22%23EF4444%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%208a6%206%200%200%201%2012%200c0%207%203%209%203%209H3s3-2%203-9%22%2F%3E%3Cpath%20d%3D%22M10.3%2021a1.94%201.94%200%200%200%203.4%200%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E"
                alt="비상벨"
                className="w-4 h-4"
              />
              <span className="text-xs font-medium">비상벨</span>
            </div>
            <div className="flex items-center gap-2">
              <img
                src="data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2232%22%20height%3D%2232%22%20viewBox%3D%220%200%2032%2032%22%3E%3Ccircle%20cx%3D%2216%22%20cy%3D%2216%22%20r%3D%2215%22%20fill%3D%22white%22%20stroke%3D%22%233B82F6%22%20stroke-width%3D%222%22%2F%3E%3Cg%20transform%3D%22translate(4%2C4)%22%3E%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22%233B82F6%22%20stroke%3D%22%233B82F6%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M19%2014c1.49-1.46%203-3.21%203-5.5A5.5%205.5%200%200%200%2016.5%203c-1.76%200-3%20.5-4.5%202-1.5-1.5-2.74-2-4.5-2A5.5%205.5%200%200%200%202%208.5c0%202.3%201.5%204.05%203%205.5l7%207Z%22%2F%3E%3C%2Fsvg%3E%3C%2Fg%3E%3C%2Fsvg%3E"
                alt="안심귀갓길"
                className="w-4 h-4"
              />
              <span className="text-xs font-medium">안심귀갓길</span>
            </div>
          </div>
        </div>
        {/* 지도 타입 전환 토글 */}
        <div className="absolute top-4 right-4 z-10">
          <div className="flex items-center gap-1 bg-background/80 backdrop-blur-sm border border-border rounded-lg p-1 shadow-lg">
            <Toggle
              pressed={mapType === "roadmap"}
              onPressedChange={(pressed) => {
                if (pressed) setMapType("roadmap");
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              aria-label="일반 지도"
            >
              <MapIcon className="h-4 w-4" />
              <span className="text-xs">지도</span>
            </Toggle>
            <Toggle
              pressed={mapType === "skyview"}
              onPressedChange={(pressed) => {
                if (pressed) setMapType("skyview");
              }}
              variant="outline"
              size="sm"
              className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              aria-label="스카이뷰"
            >
              <Satellite className="h-4 w-4" />
              <span className="text-xs">스카이뷰</span>
            </Toggle>
          </div>
        </div>
      </div>
    </>
  );
}
