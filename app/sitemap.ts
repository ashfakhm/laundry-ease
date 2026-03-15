import { MetadataRoute } from "next";

// Build date for static routes - updates on each deployment
const BUILD_DATE = new Date("2026-03-15T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

  // Define routes with their change frequency and priority for better SEO
  // Static routes that don't change often use BUILD_DATE
  const routes: MetadataRoute.Sitemap = [
    // Core landing pages - highest priority
    {
      url: baseUrl,
      lastModified: BUILD_DATE,
      changeFrequency: "daily",
      priority: 1,
    },
    // Auth pages - medium priority, rarely change
    {
      url: `${baseUrl}/auth`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/choose-role`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // Signup pages
    {
      url: `${baseUrl}/signup/seeker`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/signup/provider`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    // Complete signup flow
    {
      url: `${baseUrl}/complete-signup/seeker`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/complete-signup/provider`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    // Seeker dashboard and features
    {
      url: `${baseUrl}/seeker`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/seeker/search`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/seeker/bookings`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/seeker/invoices`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/seeker/orders`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/seeker/view-orders`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/seeker/profile`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/seeker/disputes`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    // Provider dashboard and features
    {
      url: `${baseUrl}/provider`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/provider/bookings`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/provider/manage-booking`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/provider/order-status`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/provider/invoice-generation`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/provider/profile`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/provider/profile/edit`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/provider/reviews-manage`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/provider/disputes`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/provider/messages`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.5,
    },
    // Admin pages - lower priority
    {
      url: `${baseUrl}/admin`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/admin/user-management`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/admin/payment-management`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/admin/complaints`,
      lastModified: BUILD_DATE,
      changeFrequency: "weekly",
      priority: 0.4,
    },
    // Terms and legal pages
    {
      url: `${baseUrl}/terms/seeker`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms/provider`,
      lastModified: BUILD_DATE,
      changeFrequency: "monthly",
      priority: 0.3,
    },
  ];

  return routes;
}
