import { Client } from "@googlemaps/google-maps-services-js";
import { env } from "@/lib/env";

if (!env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
  throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not defined");
}

export const googleMapsClient = new Client({});

export const GOOGLE_MAPS_API_KEY = env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
