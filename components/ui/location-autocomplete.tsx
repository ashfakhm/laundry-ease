import React, { useState, useRef, useEffect } from "react";
import { Loader2, MapPin } from "lucide-react";

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
}

interface LocationAutocompleteProps {
  value: string;
  onChange: (address: string, coords?: { lat: number; lng: number }) => void;
  placeholder?: string;
}

export const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  onChange,
  placeholder,
}) => {
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = async (input: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          input
        )}&addressdetails=1&limit=5`,
        {
          headers: {
            "Accept-Language": "en",
            "User-Agent": "LaundryEase/1.0",
          },
        }
      );
      if (!res.ok) throw new Error("Search failed");
      const data: NominatimResult[] = await res.json();
      setSuggestions(data || []);
      if (data && data.length > 0) setShowDropdown(true);
    } catch (error) {
      console.error("Nominatim fetch error:", error);
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    onChange(input);

    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!input || input.length < 3) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      fetchSuggestions(input);
    }, 800);
  };

  const handleSelect = (item: NominatimResult) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    onChange(item.display_name, { lat, lng });
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div className="relative">
        <input
          value={value}
          onChange={handleInput}
          placeholder={placeholder || "Search location..."}
          className="w-full h-11 rounded-lg border border-input bg-background pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm"
          autoComplete="off"
        />
        <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        {loading && (
          <div className="absolute right-3 top-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto overflow-x-hidden">
          {suggestions.map((s, i) => (
            <li
              key={s.place_id || i}
              className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 text-sm"
              onClick={() => handleSelect(s)}
            >
              <div className="font-medium truncate">{s.display_name.split(",")[0]}</div>
              <div className="text-xs text-muted-foreground truncate opacity-70">
                {s.display_name}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
