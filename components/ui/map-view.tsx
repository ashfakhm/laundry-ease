"use client";

import React, { useCallback, useMemo, useState } from "react";
import { GoogleMap, MarkerF } from "@react-google-maps/api";

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

export const MapView: React.FC<MapViewProps> = ({
  center,
  zoom = 15,
  markers = [],
  className = "h-64 w-full",
}) => {
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

  // Since script is loaded globally in layout, we just check for window.google
  // but usually components inside the provider are only rendered when script is loaded.
  // We can add a safety check if needed, but usually redundant.

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
