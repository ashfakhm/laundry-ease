import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { SessionProvider } from "@/components/providers/session-provider";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen w-full antialiased">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ToastProvider>{children}</ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
