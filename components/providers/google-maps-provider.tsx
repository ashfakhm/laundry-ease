"use client";

import { useLoadScript } from "@react-google-maps/api";
import { ReactNode } from "react";

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

export function GoogleMapsProvider({ children }: { children: ReactNode }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  if (!isLoaded) return null;

  return <>{children}</>;
}
