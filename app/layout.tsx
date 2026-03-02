import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import { GoogleMapsProvider } from "@/components/providers/google-maps-provider";
import JsonLd from "@/components/seo/json-ld";
import { GlobalFooter } from "@/components/ui/global-footer";
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
    default: "LaundryEase - Doorstep Laundry Service Marketplace",
    template: "%s | LaundryEase",
  },
  description:
    "LaundryEase connects busy professionals with trusted laundry providers. Book pickups, track orders, and pay securely with escrow protection. Deadline-guaranteed service.",
  keywords: [
    "laundry service",
    "doorstep pickup",
    "dry cleaning",
    "wash and fold",
    "laundry delivery",
    "online laundry",
    "laundry app",
    "escrow payment",
  ],
  authors: [{ name: "LaundryEase" }],
  creator: "LaundryEase",
  publisher: "LaundryEase",
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
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "LaundryEase - Laundry handled end-to-end",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "LaundryEase - Doorstep Laundry Service",
    description:
      "Book pickups, track orders, pay securely. Deadline-guaranteed laundry service.",
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
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
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

                <GlobalFooter />
              </div>
              <JsonLd />
            </ThemeProvider>
          </GoogleMapsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
