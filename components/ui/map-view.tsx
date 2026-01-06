"use client";

import React, { useCallback, useMemo, useState } from "react";
import { GoogleMap, useLoadScript, MarkerF } from "@react-google-maps/api";
import { Loader2 } from "lucide-react";

interface MapViewProps {
  center: { lat: number; lng: number };
  zoom?: number;
  markers?: { lat: number; lng: number; title?: string }[];
  className?: string;
}

const containerStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "0.5rem",
};

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

export const MapView: React.FC<MapViewProps> = ({
  center,
  zoom = 15,
  markers = [],
  className = "h-64 w-full",
}) => {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const onLoad = useCallback(
    (map: google.maps.Map) => {
      const bounds = new google.maps.LatLngBounds(center);
      markers.forEach((marker) => bounds.extend(marker));
      if (markers.length > 1) {
        map.fitBounds(bounds);
      }
      setMap(map);
    },
    [center, markers]
  );

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  const options = useMemo(
    () => ({
      disableDefaultUI: true,
      zoomControl: true,
    }),
    []
  );

  if (!isLoaded) {
    return (
      <div
        className={`flex items-center justify-center bg-muted ${className} rounded-lg`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className}>
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={zoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={options}
      >
        {/* Main Center Marker */}
        <MarkerF position={center} />

        {/* Additional Markers */}
        {markers.map((marker, idx) => (
          <MarkerF
            key={idx}
            position={marker}
            title={marker.title}
            icon={
              idx > 0
                ? {
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: 7,
                    fillColor: "#0F172A",
                    fillOpacity: 1,
                    strokeColor: "white",
                    strokeWeight: 2,
                  }
                : undefined
            }
          />
        ))}
      </GoogleMap>
    </div>
  );
};
