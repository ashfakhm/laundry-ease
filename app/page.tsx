import type { Metadata } from "next";
import { LandingPageClient } from "@/components/landing-page-client";

export const metadata: Metadata = {
  title: "LaundryEase – Premium Laundry Service",
  description:
    "LaundryEase is a premium laundry SaaS platform offering doorstep pickup, deadline-guaranteed delivery, and secure escrow payments for urban professionals.",
  openGraph: {
    title: "LaundryEase – Premium Laundry Service",
    description:
      "LaundryEase is a premium laundry SaaS platform offering doorstep pickup, deadline-guaranteed delivery, and secure escrow payments for urban professionals.",
    url: "https://laundryease.com",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LaundryEase - Laundry handled end-to-end",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LaundryEase – Premium Laundry Service",
    description:
      "LaundryEase is a premium laundry SaaS platform offering doorstep pickup, deadline-guaranteed delivery, and secure escrow payments for urban professionals.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "https://laundryease.com",
    languages: {
      "en-US": "https://laundryease.com/en-US",
      "en-IN": "https://laundryease.com/en-IN",
    },
  },
};

export default function LandingPage() {
  return <LandingPageClient />;
}
