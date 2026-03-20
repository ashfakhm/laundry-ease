"use client";

import * as React from "react";
import {
  DEFAULT_THEME,
  isTheme,
  resolveTheme,
  THEME_MEDIA_QUERY,
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme";

type ThemeContextValue = {
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  theme: Theme;
};

export type ThemeProviderProps = {
  attribute?: string;
  children: React.ReactNode;
  defaultTheme?: Theme;
  disableTransitionOnChange?: boolean;
  enableSystem?: boolean;
  storageKey?: string;
};

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

function disableTransitionsTemporarily() {
  const style = document.createElement("style");
  style.textContent =
    "*,*::before,*::after{-webkit-transition:none!important;transition:none!important}";
  document.head.appendChild(style);

  return () => {
    window.getComputedStyle(document.body);
    window.setTimeout(() => {
      style.remove();
    }, 1);
  };
}

function readStoredTheme(storageKey: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  const storedTheme = window.localStorage.getItem(storageKey);
  return isTheme(storedTheme) ? storedTheme : undefined;
}

function applyTheme(attribute: string, resolvedTheme: ResolvedTheme) {
  const root = document.documentElement;

  if (attribute === "class") {
    root.classList.toggle("dark", resolvedTheme === "dark");
  } else {
    root.setAttribute(attribute, resolvedTheme);
  }

  root.style.colorScheme = resolvedTheme;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const {
    attribute = "class",
    defaultTheme = DEFAULT_THEME,
    disableTransitionOnChange = false,
    enableSystem = true,
    storageKey = THEME_STORAGE_KEY,
  } = props;

  const [theme, setThemeState] = React.useState<Theme>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }

    return defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = React.useState<ResolvedTheme>(() => {
    if (typeof document !== "undefined") {
      return document.documentElement.classList.contains("dark") ? "dark" : "light";
    }

    return defaultTheme === "system" ? DEFAULT_THEME : defaultTheme;
  });

  React.useEffect(() => {
    const nextTheme = readStoredTheme(storageKey) ?? defaultTheme;
    const nextResolvedTheme = resolveTheme(
      nextTheme,
      enableSystem,
      defaultTheme === "system" ? DEFAULT_THEME : defaultTheme
    );

    setThemeState(nextTheme);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(attribute, nextResolvedTheme);
  }, [attribute, defaultTheme, enableSystem, storageKey]);

  React.useEffect(() => {
    if (!enableSystem || theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia(THEME_MEDIA_QUERY);
    const syncSystemTheme = () => {
      const nextResolvedTheme = mediaQuery.matches ? "dark" : "light";
      setResolvedTheme(nextResolvedTheme);
      applyTheme(attribute, nextResolvedTheme);
    };

    syncSystemTheme();
    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", syncSystemTheme);
    };
  }, [attribute, enableSystem, theme]);

  React.useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== storageKey) {
        return;
      }

      const nextTheme = readStoredTheme(storageKey) ?? defaultTheme;
      const nextResolvedTheme = resolveTheme(
        nextTheme,
        enableSystem,
        defaultTheme === "system" ? DEFAULT_THEME : defaultTheme
      );

      setThemeState(nextTheme);
      setResolvedTheme(nextResolvedTheme);
      applyTheme(attribute, nextResolvedTheme);
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [attribute, defaultTheme, enableSystem, storageKey]);

  const setTheme = (nextTheme: Theme) => {
    const cleanup = disableTransitionOnChange ? disableTransitionsTemporarily() : undefined;
    const nextResolvedTheme = resolveTheme(
      nextTheme,
      enableSystem,
      defaultTheme === "system" ? DEFAULT_THEME : defaultTheme
    );

    window.localStorage.setItem(storageKey, nextTheme);
    setThemeState(nextTheme);
    setResolvedTheme(nextResolvedTheme);
    applyTheme(attribute, nextResolvedTheme);
    cleanup?.();
  };

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const value = React.useContext(ThemeContext);

  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return value;
}
