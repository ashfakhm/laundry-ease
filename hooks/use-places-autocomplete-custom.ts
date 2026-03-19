"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface AutocompletePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface GooglePlacePrediction {
  placeId: string;
  text?: { text: string } | string;
  mainText?: { text: string } | string;
  secondaryText?: { text: string } | string;
}

interface GoogleAutocompleteSuggestion {
  placePrediction?: GooglePlacePrediction;
}

interface LegacyRequestOptions {
  componentRestrictions?: {
    country?: string;
  };
}

interface CustomAutocompleteRequest {
  input: string;
  includedRegionCodes?: string[];
  componentRestrictions?: {
    country?: string;
  };
}

export interface HookArgs {
  requestOptions?: Record<string, unknown>;
  debounce?: number;
}

export default function usePlacesAutocomplete({
  requestOptions = {},
  debounce = 300,
}: HookArgs = {}) {
  const [ready, setReady] = useState(false);
  const [value, setValueState] = useState("");
  const [suggestions, setSuggestions] = useState<{
    loading: boolean;
    status: string;
    data: AutocompletePrediction[];
  }>({
    loading: false,
    status: "",
    data: [],
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize and check for global google object
  useEffect(() => {
    const checkGoogle = async () => {
      if (typeof window !== "undefined" && window.google?.maps) {
        setReady(true);
      } else {
        const interval = setInterval(() => {
          if (typeof window !== "undefined" && window.google?.maps) {
            setReady(true);
            clearInterval(interval);
          }
        }, 500);
        return () => clearInterval(interval);
      }
    };
    checkGoogle();
  }, []);

  const fetchPredictions = useCallback(
    async (input: string) => {
      if (!input.trim()) {
        setSuggestions({ loading: false, status: "", data: [] });
        return;
      }

      setSuggestions((prev) => ({ ...prev, loading: true }));

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const googleMaps = window.google.maps as any;
        
        // Use importLibrary to ensure we have the places library correctly loaded.
        const placesLib = await googleMaps.importLibrary("places");
        const AutocompleteSuggestion = placesLib.AutocompleteSuggestion;

        if (!AutocompleteSuggestion) {
          throw new Error("AutocompleteSuggestion is not available in places library");
        }

        const request: CustomAutocompleteRequest = {
          input,
          ...requestOptions,
        };

        // Map componentRestrictions to includedRegionCodes for backward compatibility with AutocompleteSuggestion
        const options = requestOptions as LegacyRequestOptions;
        if (options?.componentRestrictions?.country) {
          request.includedRegionCodes = [options.componentRestrictions.country.toUpperCase()];
          delete request.componentRestrictions;
        }

        const response = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
        
        if (response && response.suggestions) {
          const mappedData: AutocompletePrediction[] = response.suggestions.map((s: GoogleAutocompleteSuggestion) => {
            const p = s.placePrediction;
            if (!p) return null;
            return {
              place_id: p.placeId,
              description: typeof p.text === "object" ? p.text.text : p.text || "",
              structured_formatting: {
                main_text: typeof p.mainText === "object" ? p.mainText.text : p.mainText || "",
                secondary_text: typeof p.secondaryText === "object" ? p.secondaryText.text : p.secondaryText || "",
              },
            };
          }).filter((s: AutocompletePrediction | null): s is AutocompletePrediction => s !== null);

          setSuggestions({
            loading: false,
            status: mappedData.length > 0 ? "OK" : "ZERO_RESULTS",
            data: mappedData,
          });
        } else {
          setSuggestions({ loading: false, status: "ZERO_RESULTS", data: [] });
        }
      } catch (error) {
        setSuggestions({ loading: false, status: "ERROR", data: [] });
        console.error("fetchAutocompleteSuggestions Error:", error);
      }
    },
    [requestOptions]
  );

  const setValue = useCallback(
    (val: string, shouldFetchData = true) => {
      setValueState(val);
      
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      if (shouldFetchData && val.trim()) {
        debounceTimer.current = setTimeout(() => {
          fetchPredictions(val);
        }, debounce);
      } else if (!val.trim()) {
        setSuggestions({ loading: false, status: "", data: [] });
      }
    },
    [debounce, fetchPredictions]
  );

  const clearSuggestions = useCallback(() => {
    setSuggestions({ loading: false, status: "", data: [] });
  }, []);

  return {
    ready,
    value,
    suggestions,
    setValue,
    clearSuggestions,
  };
}

/**
 * Geocode wrapper mimicking use-places-autocomplete getGeocode
 */
export const getGeocode = (args: google.maps.GeocoderRequest): Promise<google.maps.GeocoderResult[]> => {
  const geocoder = new window.google.maps.Geocoder();

  return new Promise((resolve, reject) => {
    geocoder.geocode(args, (results, status) => {
      if (status !== "OK") {
        reject(status);
      } else {
        resolve(results || []);
      }
    });
  });
};

/**
 * getLatLng wrapper mimicking use-places-autocomplete getLatLng
 */
export const getLatLng = (result: google.maps.GeocoderResult): { lat: number; lng: number } => {
  const { lat, lng } = result.geometry.location;
  return { lat: lat(), lng: lng() };
};
