"use client";

import { useState, useEffect, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import { useMapStore } from "@/store/mapStore";
import { Search, Loader2 } from "lucide-react";
import useKakaoLoader from "@/hooks/useKakaoLoader";
import SearchResults from "./SearchResults";

interface PlaceResult {
  id?: string; // unique ID (kakao place id or address id)
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string; // lng
  y: string; // lat
}

// 두 좌표 간 거리 계산 (Haversine formula) - km 단위
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function SearchSheet() {
  useKakaoLoader();
  const { isModalOpen, modalType, closeModal, openModal } = useUIStore();
  const { setCenter, setSelectedEnd, setDestinationInfo, currentPosition } =
    useMapStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const isSearchOpen = isModalOpen && modalType === "search";

  // 모달이 닫힐 때 검색 상태 초기화
  useEffect(() => {
    if (!isSearchOpen) {
      setSearchQuery("");
      setResults([]);
      setIsSearching(false);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    }
  }, [isSearchOpen]);

  // 검색어 변경 시 자동 검색 (debounce)
  useEffect(() => {
    if (!isSearchOpen) return;

    // 이전 타이머 취소
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // 검색어가 비어있으면 결과 초기화
    if (!searchQuery.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    // 300ms 후에 검색 실행 (debounce)
    setIsSearching(true);
    debounceTimerRef.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [searchQuery, isSearchOpen]);

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    try {
      const ps = new kakao.maps.services.Places();
      const geocoder = new kakao.maps.services.Geocoder();

      // 키워드 검색 옵션 설정
      const keywordOptions: any = {};
      if (currentPosition) {
        keywordOptions.location = new kakao.maps.LatLng(
          currentPosition.lat,
          currentPosition.lng
        );
        keywordOptions.radius = 20000; // 20km 반경 우선 검색
        keywordOptions.sort = kakao.maps.services.SortBy.ACCURACY; // 정확도순 (거리는 이미 필터링)
      }

      // 키워드 검색 프로미스
      const keywordSearchPromise = new Promise<PlaceResult[]>((resolve) => {
        ps.keywordSearch(
          query,
          (data, status) => {
            if (status === kakao.maps.services.Status.OK) {
              const places = data.map((place: any) => ({
                place_name: place.place_name,
                address_name: place.address_name,
                road_address_name: place.road_address_name,
                x: place.x,
                y: place.y,
                id: place.id, // 중복 제거용 ID
              }));
              resolve(places);
            } else {
              resolve([]);
            }
          },
          keywordOptions
        );
      });

      // 주소 검색 프로미스
      const addressSearchPromise = new Promise<PlaceResult[]>((resolve) => {
        geocoder.addressSearch(query, (result, status) => {
          if (status === kakao.maps.services.Status.OK) {
            const places = result.map((addr: any) => ({
              place_name: addr.address_name, // 주소 자체를 장소명으로 사용
              address_name: addr.address_name,
              road_address_name: addr.road_address?.address_name || "",
              x: addr.x,
              y: addr.y,
              id: `addr-${addr.address_name}`, // 주소 검색 결과용 가상 ID
            }));
            resolve(places);
          } else {
            resolve([]);
          }
        });
      });

      // 두 검색 병렬 실행
      const [keywordResults, addressResults] = await Promise.all([
        keywordSearchPromise,
        addressSearchPromise,
      ]);

      // 결과 병합 및 중복 제거
      // 주소 검색 결과를 우선순위로 둠 (사용자가 주소를 입력했을 가능성 고려)
      const allResults = [...addressResults, ...keywordResults];

      // 중복 제거 (좌표 기준 - 대략적인 위치가 같으면 같은 장소로 간주)
      // 또는 ID 기준? 주소 검색은 ID가 없어서 좌표로 하는게 나을수도 있음.
      // 여기서는 간단히 ID(키워드 검색)와 좌표(주소 검색) 조합으로 필터링
      const uniqueResults = allResults.filter(
        (place, index, self) =>
          index ===
          self.findIndex(
            (t) =>
              (t.id && t.id === place.id) ||
              (t.x === place.x && t.y === place.y)
          )
      );

      setResults(uniqueResults);
    } catch (error) {
      console.error("검색 중 오류 발생:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectPlace = (place: PlaceResult) => {
    const coord = {
      lat: parseFloat(place.y),
      lng: parseFloat(place.x),
    };

    setCenter(coord);
    setSelectedEnd(coord);
    setDestinationInfo({
      place_name: place.place_name,
      address_name: place.address_name,
      road_address_name: place.road_address_name,
      coord,
    });

    // 검색 상태 초기화
    setSearchQuery("");
    setResults([]);
    setIsSearching(false);

    closeModal(); // 검색 Sheet 닫기
    openModal("route"); // 길찾기 Sheet 열기
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      // Enter 키를 누르면 즉시 검색 (debounce 무시)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      handleSearch(searchQuery);
    }
  };

  return (
    <Sheet open={isSearchOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent side="top" className="h-[80vh] flex flex-col">
        <SheetHeader className="shrink-0">
          <SheetTitle>목적지 검색</SheetTitle>
          <SheetDescription>검색할 장소를 입력하세요</SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col flex-1 min-h-0 space-y-4">
          {/* 검색 입력 */}
          <div className="flex gap-2 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="장소, 주소 검색"
                className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>
            <button
              onClick={() => {
                if (debounceTimerRef.current) {
                  clearTimeout(debounceTimerRef.current);
                  debounceTimerRef.current = null;
                }
                handleSearch(searchQuery);
              }}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
            >
              {isSearching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "검색"
              )}
            </button>
          </div>

          {/* 검색 결과 - 스크롤 가능 영역 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <SearchResults
              results={results}
              onSelectPlace={handleSelectPlace}
              searchQuery={searchQuery}
              isSearching={isSearching}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
