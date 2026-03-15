"use client";

import Script from "next/script";

interface BreadcrumbItem {
  name: string;
  item: string;
}

interface BreadcrumbJsonLdProps {
  items: BreadcrumbItem[];
}

/**
 * BreadcrumbJsonLd - Generates Schema.org BreadcrumbList structured data
 *
 * Usage:
 * <BreadcrumbJsonLd items={[
 *   { name: "Home", item: "https://laundryease.in" },
 *   { name: "Seeker", item: "https://laundryease.in/seeker" },
 *   { name: "Search", item: "https://laundryease.in/seeker/search" },
 * ]} />
 */
export default function BreadcrumbJsonLd({ items }: BreadcrumbJsonLdProps) {
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.item,
    })),
  };

  return (
    <Script
      id="jsonld-breadcrumb"
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
    />
  );
}

/**
 * Predefined breadcrumb paths for common routes
 */
export const breadcrumbPaths = {
  home: { name: "Home", item: "https://laundryease.in" },
  seeker: { name: "Seeker Dashboard", item: "https://laundryease.in/seeker" },
  seekerSearch: {
    name: "Find Providers",
    item: "https://laundryease.in/seeker/search",
  },
  seekerBookings: {
    name: "My Bookings",
    item: "https://laundryease.in/seeker/bookings",
  },
  seekerOrders: {
    name: "My Orders",
    item: "https://laundryease.in/seeker/orders",
  },
  seekerInvoices: {
    name: "My Invoices",
    item: "https://laundryease.in/seeker/invoices",
  },
  seekerProfile: {
    name: "Profile",
    item: "https://laundryease.in/seeker/profile",
  },
  provider: {
    name: "Provider Dashboard",
    item: "https://laundryease.in/provider",
  },
  providerBookings: {
    name: "Bookings",
    item: "https://laundryease.in/provider/bookings",
  },
  providerOrders: {
    name: "Order Status",
    item: "https://laundryease.in/provider/order-status",
  },
  providerInvoices: {
    name: "Invoices",
    item: "https://laundryease.in/provider/invoice-generation",
  },
  providerProfile: {
    name: "Profile",
    item: "https://laundryease.in/provider/profile",
  },
  admin: { name: "Admin Dashboard", item: "https://laundryease.in/admin" },
  auth: { name: "Sign In", item: "https://laundryease.in/auth" },
  signup: { name: "Sign Up", item: "https://laundryease.in/choose-role" },
  termsSeeker: {
    name: "Seeker Terms",
    item: "https://laundryease.in/terms/seeker",
  },
  termsProvider: {
    name: "Provider Terms",
    item: "https://laundryease.in/terms/provider",
  },
};
