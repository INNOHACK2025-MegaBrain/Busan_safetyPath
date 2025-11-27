"use client";

import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useUIStore } from "@/store/uiStore";
import { useMapStore } from "@/store/mapStore";
import { Search, MapPin, Loader2 } from "lucide-react";
import useKakaoLoader from "@/hooks/useKakaoLoader";

interface PlaceResult {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string; // lng
  y: string; // lat
}

export default function SearchSheet() {
  useKakaoLoader();
  const { isModalOpen, modalType, closeModal } = useUIStore();
  const { setCenter, setSelectedEnd } = useMapStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const isSearchOpen = isModalOpen && modalType === "search";

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setResults([]);

    try {
      // 카카오맵 Places API 사용
      const ps = new kakao.maps.services.Places();
      
      ps.keywordSearch(searchQuery, (data, status) => {
        setIsSearching(false);
        
        if (status === kakao.maps.services.Status.OK) {
          const places: PlaceResult[] = data.map((place: any) => ({
            place_name: place.place_name,
            address_name: place.address_name,
            road_address_name: place.road_address_name,
            x: place.x,
            y: place.y,
          }));
          setResults(places);
        } else if (status === kakao.maps.services.Status.ZERO_RESULT) {
          setResults([]);
        } else {
          console.error("검색 실패:", status);
        }
      });
    } catch (error) {
      console.error("검색 중 오류 발생:", error);
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
    closeModal();
    setSearchQuery("");
    setResults([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <Sheet open={isSearchOpen} onOpenChange={(open) => !open && closeModal()}>
      <SheetContent side="top" className="h-[80vh]">
        <SheetHeader>
          <SheetTitle>목적지 검색</SheetTitle>
          <SheetDescription>검색할 장소를 입력하세요</SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {/* 검색 입력 */}
          <div className="flex gap-2">
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
              onClick={handleSearch}
              disabled={isSearching || !searchQuery.trim()}
              className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSearching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "검색"
              )}
            </button>
          </div>

          {/* 검색 결과 */}
          <div className="flex-1 overflow-y-auto">
            {results.length > 0 ? (
              <div className="space-y-2">
                {results.map((place, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectPlace(place)}
                    className="w-full p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors mt-1">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {place.place_name}
                        </p>
                        <p className="text-sm text-muted-foreground truncate">
                          {place.road_address_name || place.address_name}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : searchQuery && !isSearching ? (
              <div className="text-center py-8 text-muted-foreground">
                검색 결과가 없습니다
              </div>
            ) : null}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

