import type { Metadata } from "next";
import { ThemeProvider } from "../components/ui/theme-provider";
import { SessionProvider } from "../components/providers/session-provider";
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen w-full">
        <SessionProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
