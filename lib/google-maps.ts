import { Client } from "@googlemaps/google-maps-services-js";

if (!process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) {
  throw new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not defined");
}

export const googleMapsClient = new Client({});

export const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
