import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { SocketProvider } from "@/components/providers/socket-provider";
import { ToastProvider } from "@/components/ui/toast";
import { GoogleMapsProvider } from "@/components/providers/google-maps-provider";
import JsonLd from "@/components/seo/json-ld";

import { InteractiveGridPattern } from "@/components/ui/interactive-grid";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://laundryease.in";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: "LaundryEase - Doorstep Laundry Service Marketplace | India",
    template: "%s | LaundryEase",
  },
  description:
    "LaundryEase connects busy professionals with trusted laundry providers. Book doorstep pickups, track orders in real-time, and pay securely with escrow protection. Deadline-guaranteed laundry service across India.",
  keywords: [
    "laundry service",
    "doorstep pickup",
    "dry cleaning",
    "wash and fold",
    "laundry delivery",
    "online laundry",
    "laundry app",
    "escrow payment",
    "laundry near me",
    "ironing service",
    "premium laundry",
    "express laundry",
    "India",
  ],
  authors: [{ name: "LaundryEase" }],
  creator: "LaundryEase",
  publisher: "LaundryEase",
  generator: "Next.js",
  applicationName: "LaundryEase",
  referrer: "origin-when-cross-origin",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: APP_URL,
    siteName: "LaundryEase",
    title: "LaundryEase - Doorstep Laundry Service Marketplace",
    description:
      "Book doorstep laundry pickups, track orders in real-time, and pay securely. Deadline-guaranteed service with escrow protection.",
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "LaundryEase - Premium laundry service marketplace with escrow protection",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@laundryease",
    creator: "@laundryease",
    title: "LaundryEase - Doorstep Laundry Service",
    description:
      "Book pickups, track orders, pay securely. Deadline-guaranteed laundry service.",
    images: [
      {
        url: `${APP_URL}/og-image.png`,
        alt: "LaundryEase - Premium laundry service marketplace with escrow protection",
      },
    ],
  },
  alternates: {
    canonical: APP_URL,
    languages: {
      "en-IN": APP_URL,
      en: APP_URL,
      "hi-IN": `${APP_URL}/hi`,
    },
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48 32x32 16x16", type: "image/x-icon" },
      { url: "/icon.png", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/icon.png",
        color: "#0a0a0a",
      },
    ],
  },
  category: "lifestyle",
  classification: "Laundry Service Marketplace",
  other: {
    "msapplication-TileColor": "#0a0a0a",
    "msapplication-config": "/browserconfig.xml",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "LaundryEase",
    "mobile-web-app-capable": "yes",
    "theme-color": "#0a0a0a",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`min-h-screen w-full antialiased ${inter.variable} overflow-x-hidden selection:bg-primary/20 selection:text-primary`}
      >
        <SessionProvider>
          <SocketProvider>
            <GoogleMapsProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="dark"
                enableSystem={false}
                disableTransitionOnChange
              >
                {/* Global High-Tech Background */}
                <InteractiveGridPattern />
                <div className="relative z-10 w-full min-h-screen flex flex-col">
                  <header role="banner" className="sr-only">
                    {/* Main site header is rendered in individual pages for flexibility */}
                    LaundryEase
                  </header>
                  <main
                    id="main-content"
                    role="main"
                    className="flex-1 flex flex-col"
                  >
                    <ToastProvider>{children}</ToastProvider>
                  </main>
                </div>
                <JsonLd />
              </ThemeProvider>
            </GoogleMapsProvider>
          </SocketProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
