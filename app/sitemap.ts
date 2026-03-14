import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

  // Static routes
  const staticRoutes = [
    "",
    "/auth",
    "/signup/seeker",
    "/signup/provider",
    "/seeker",
    "/seeker/search",
    "/provider",
  ];
  const routes = staticRoutes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date().toISOString(),
    changeFrequency: "daily" as const,
    priority: route === "" ? 1 : 0.8,
  }));

  return routes;
}
