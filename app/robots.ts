import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: ["/admin/", "/api/", "/complete-signup/", "/choose-role/"],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
    host: baseUrl,
  };
}
