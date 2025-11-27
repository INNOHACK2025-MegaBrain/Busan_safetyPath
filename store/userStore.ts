// src/store/mapStore.ts
import { create } from "zustand";

type Coord = { lat: number; lng: number };

interface MapStore {
  center: Coord;
  level: number;
  selectedPoint: {
    start?: Coord;
    end?: Coord;
  };
  weights: {
    cctv: number;
    crime: number;
    light: number;
    roadSafety: number;
  };

  setCenter: (center: Coord) => void;
  setLevel: (level: number) => void;
  setSelectedStart: (coord: Coord) => void;
  setSelectedEnd: (coord: Coord) => void;
  setWeight: (key: keyof MapStore["weights"], value: number) => void;
  resetSelectedPoints: () => void;
}

export const useMapStore = create<MapStore>((set) => ({
  center: { lat: 35.1796, lng: 129.0756 }, // 부산 시청 기본값
  level: 5,
  selectedPoint: {},
  weights: {
    cctv: 1,
    crime: 1,
    light: 1,
    roadSafety: 1,
  },

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

  setWeight: (key, value) =>
    set((state) => ({
      weights: { ...state.weights, [key]: value },
    })),

  resetSelectedPoints: () => set({ selectedPoint: {} }),
}));
