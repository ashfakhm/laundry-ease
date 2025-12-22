import React, { useState, useRef, useEffect } from "react";
import { APIProvider, useMapsLibrary, useMap } from "@vis.gl/react-google-maps";

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
  const inputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const placesLib = useMapsLibrary("places");
  const [autocompleteService, setAutocompleteService] = useState<any>(null);
  const [geocoder, setGeocoder] = useState<any>(null);

  useEffect(() => {
    if (placesLib) {
      setAutocompleteService(new placesLib.AutocompleteService());
      setGeocoder(new placesLib.Geocoder());
    }
  }, [placesLib]);

  const handleInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    onChange(input);
    if (!autocompleteService || !input) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    setLoading(true);
    autocompleteService.getPlacePredictions({ input }, (predictions: any[]) => {
      setSuggestions(predictions || []);
      setShowDropdown(true);
      setLoading(false);
    });
  };

  const handleSelect = (suggestion: any) => {
    if (!geocoder) return;
    geocoder.geocode(
      { placeId: suggestion.place_id },
      (results: any[], status: string) => {
        if (status === "OK" && results[0]) {
          const loc = results[0].geometry.location;
          onChange(results[0].formatted_address, {
            lat: loc.lat(),
            lng: loc.lng(),
          });
        } else {
          onChange(suggestion.description);
        }
      }
    );
    setShowDropdown(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleInput}
        placeholder={placeholder || "Enter a location"}
        className="w-full h-11 rounded-lg border border-input bg-background px-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all"
        autoComplete="off"
        onFocus={() => value && suggestions.length > 0 && setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
      />
      {showDropdown && suggestions.length > 0 && (
        <ul className="absolute z-10 w-full bg-white border border-border rounded-lg shadow-lg mt-1 max-h-60 overflow-auto">
          {suggestions.map((s) => (
            <li
              key={s.place_id}
              className="px-4 py-2 cursor-pointer hover:bg-muted"
              onMouseDown={() => handleSelect(s)}
            >
              {s.description}
            </li>
          ))}
        </ul>
      )}
      {loading && (
        <div className="absolute right-3 top-3 text-xs text-muted-foreground">
          Loading...
        </div>
      )}
    </div>
  );
};
