import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

  // Static routes
  const routes = [
    "",
    "/auth",
    "/signup/seeker",
    "/signup/provider",
    "/seeker",
    "/seeker/search",
    "/provider",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  return routes;
}
