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
  setWeight: (key: keyof MapStore["weights"], value: number) => void;
  resetSelectedPoints: () => void;
}

export const useMapStore = create<MapStore>((set) => ({
  center: { lat: 35.1796, lng: 129.0756 }, // 부산 시청 기본값
  level: 5,
  selectedPoint: {},
  destinationInfo: null,
  routePath: null,
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

  setWeight: (key, value) =>
    set((state) => ({
      weights: { ...state.weights, [key]: value },
    })),

  resetSelectedPoints: () => set({ selectedPoint: {} }),
}));
