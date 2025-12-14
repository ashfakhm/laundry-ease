import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { ThemeProvider } from "./components/ui/theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "LaundryEase",
    template: "%s | LaundryEase",
  },
  description:
    "LaundryEase: We grab it, track it, deliver it fresh — hassle-free!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning>
        <body>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <main className="max-w-7xl mx-auto w-full px-4 md:px-6 lg:px-8">
              {children}
            </main>
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
