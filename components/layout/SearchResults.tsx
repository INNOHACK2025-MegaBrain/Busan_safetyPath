"use client";

import { MapPin } from "lucide-react";

interface PlaceResult {
  place_name: string;
  address_name: string;
  road_address_name?: string;
  x: string; // lng
  y: string; // lat
}

interface SearchResultsProps {
  results: PlaceResult[];
  onSelectPlace: (place: PlaceResult) => void;
  searchQuery: string;
  isSearching: boolean;
}

export default function SearchResults({
  results,
  onSelectPlace,
  searchQuery,
  isSearching,
}: SearchResultsProps) {
  if (isSearching) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">검색 중...</p>
      </div>
    );
  }

  if (results.length > 0) {
    return (
      <div className="space-y-2">
        {results.map((place, index) => (
          <button
            key={index}
            onClick={() => onSelectPlace(place)}
            className="w-full p-4 rounded-lg border border-border hover:bg-accent transition-colors text-left group"
          >
            <div className="flex items-start gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary group-hover:bg-primary/20 transition-colors mt-1 shrink-0">
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
    );
  }

  if (searchQuery && !isSearching) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        검색 결과가 없습니다
      </div>
    );
  }

  return null;
}

