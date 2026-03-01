"use client";

import { useEffect, type ChangeEvent } from "react";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import { Loader2, MapPin } from "lucide-react";
import { reportError } from "@/lib/client-error";

interface LocationAutocompleteProps {
  value: string;
  onChange: (
    address: string,
    coords?: { lat: number; lng: number; city?: string; pincode?: string }
  ) => void;
  placeholder?: string;
}

export const LocationAutocomplete = ({
  value,
  onChange,
  placeholder,
}: LocationAutocompleteProps) => {
  const {
    ready,
    value: searchValue,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      /* Define search scope here if needed, e.g., componentRestrictions: { country: "in" } */
      componentRestrictions: { country: "in" },
    },
    debounce: 300,
  });

  // Sync external value with internal state if it changes unexpectedly (optional)
  useEffect(() => {
    if (value !== searchValue) {
      setValue(value, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleInput = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    // Note: Only propagate the text value without coordinates
    // User must select from suggestions to get coordinates
    onChange(e.target.value);
  };

  const handleSelect = async (description: string) => {
    setValue(description, false);
    clearSuggestions();

    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);

      // Extract city and pincode from address components
      let city = "";
      let pincode = "";
      results[0].address_components.forEach((component) => {
        if (component.types.includes("locality")) {
          city = component.long_name;
        }
        if (component.types.includes("postal_code")) {
          pincode = component.long_name;
        }
      });

      onChange(description, { lat, lng, city, pincode });
    } catch (error) {
      reportError("GeocodingError", error);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          value={searchValue}
          onChange={handleInput}
          disabled={!ready}
          placeholder={placeholder || "Search location..."}
          className="w-full h-11 rounded-lg border border-input bg-background pl-10 pr-4 text-sm focus:border-primary focus:ring-1 focus:ring-primary transition-all shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          autoComplete="off"
        />
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {!ready && (
          <div className="absolute right-3 top-3">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {status === "OK" && (
        <ul className="absolute z-50 w-full bg-popover text-popover-foreground border border-border rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto overflow-x-hidden">
          {data.map(({ place_id, description, structured_formatting }) => (
            <li
              key={place_id}
              className="px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors border-b border-border/50 last:border-0 text-sm"
              onClick={() => handleSelect(description)}
            >
              <div className="font-medium truncate">
                {structured_formatting.main_text}
              </div>
              <div className="text-xs text-muted-foreground truncate opacity-70">
                {structured_formatting.secondary_text}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
