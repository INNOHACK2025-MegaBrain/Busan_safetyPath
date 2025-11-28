import { create } from "zustand";

type Coord = { lat: number; lng: number };

interface DestinationInfo {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  coord: Coord;
}

interface MapStore {
  center: Coord;
  level: number;
  selectedPoint: {
    start?: Coord;
    end?: Coord;
  };

  currentPosition: Coord | null;

  destinationInfo: DestinationInfo | null;
  routePath: Coord[] | null; // 계산된 경로
  showDestinationOverlay: boolean; // 목적지 오버레이 표시 여부
  securityLights: Array<{
    id: string;
    latitude: number;
    longitude: number;
    si_do?: string;
    si_gun_gu?: string;
    eup_myeon_dong?: string;
    address_lot?: string;
  }>; // 보안등 정보
  safeReturnPaths: Array<{
    id: string;
    start_latitude: number;
    start_longitude: number;
    end_latitude: number;
    end_longitude: number;
    start_address: string;
    end_address: string;
    district: string;
  }>; // 여성 안심 귀갓길 정보
  emergencyBells: Array<{
    id: string;
    latitude: number;
    longitude: number;
    location?: string;
    category?: string;
  }>; // 비상벨 정보
  weights: {
    cctv: number;
    crime: number;
    light: number;
    roadSafety: number;
  };
  setCurrentPosition: (position: Coord | null) => void;
  setCenter: (center: Coord) => void;
  setLevel: (level: number) => void;
  setSelectedStart: (coord: Coord) => void;
  setSelectedEnd: (coord: Coord) => void;
  setDestinationInfo: (info: DestinationInfo | null) => void;
  setRoutePath: (path: Coord[] | null) => void;
  setShowDestinationOverlay: (show: boolean) => void;
  setSecurityLights: (lights: MapStore["securityLights"]) => void;
  setSafeReturnPaths: (paths: MapStore["safeReturnPaths"]) => void;
  setEmergencyBells: (bells: MapStore["emergencyBells"]) => void;
  setWeight: (key: keyof MapStore["weights"], value: number) => void;
  resetSelectedPoints: () => void;
}

export const useMapStore = create<MapStore>((set) => ({
  center: { lat: 35.1796, lng: 129.0756 }, // 부산 시청 기본값
  level: 5,
  selectedPoint: {},
  destinationInfo: null,
  routePath: null,
  showDestinationOverlay: false,
  securityLights: [],
  safeReturnPaths: [],
  emergencyBells: [],
  weights: {
    cctv: 1,
    crime: 1,
    light: 1,
    roadSafety: 1,
  },
  currentPosition: null,
  setCurrentPosition: (position) => set({ currentPosition: position }),
  setCenter: (center) => set({ center }),
  setLevel: (level) => set({ level }),

  setSelectedStart: (coord) =>
    set((state) => ({
      selectedPoint: { ...state.selectedPoint, start: coord },
    })),

  setSelectedEnd: (coord) =>
    set((state) => ({
      selectedPoint: { ...state.selectedPoint, end: coord },
    })),

  setDestinationInfo: (info) => set({ destinationInfo: info }),
  setRoutePath: (path) => set({ routePath: path }),
  setShowDestinationOverlay: (show) => set({ showDestinationOverlay: show }),
  setSecurityLights: (lights: MapStore["securityLights"]) =>
    set({ securityLights: lights }),
  setSafeReturnPaths: (paths: MapStore["safeReturnPaths"]) =>
    set({ safeReturnPaths: paths }),
  setEmergencyBells: (bells: MapStore["emergencyBells"]) =>
    set({ emergencyBells: bells }),

  setWeight: (key, value) =>
    set((state) => ({
      weights: { ...state.weights, [key]: value },
    })),

  resetSelectedPoints: () => set({ selectedPoint: {} }),
}));
