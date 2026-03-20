"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { ThemeProviderProps } from "next-themes";

// Dynamically import next-themes with ssr: false to prevent the inline
// <script> tag injection during SSR, which triggers a React 19 console error:
// "Encountered a script tag while rendering React component."
const NextThemesProvider = dynamic(
  () => import("next-themes").then((mod) => mod.ThemeProvider),
  { ssr: false }
);

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
