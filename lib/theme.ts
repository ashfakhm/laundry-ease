export const THEME_STORAGE_KEY = "theme";
export const DEFAULT_THEME = "dark";
export const THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function resolveTheme(
  theme: Theme,
  enableSystem: boolean,
  fallbackTheme: ResolvedTheme = DEFAULT_THEME
): ResolvedTheme {
  if (theme === "system") {
    if (!enableSystem || typeof window === "undefined") {
      return fallbackTheme;
    }

    return window.matchMedia(THEME_MEDIA_QUERY).matches ? "dark" : "light";
  }

  return theme;
}

export function getThemeInitScript({
  attribute = "class",
  defaultTheme = DEFAULT_THEME,
  enableSystem = true,
  storageKey = THEME_STORAGE_KEY,
}: {
  attribute?: string;
  defaultTheme?: Theme;
  enableSystem?: boolean;
  storageKey?: string;
}) {
  return `(() => {
  try {
    const attribute = ${JSON.stringify(attribute)};
    const defaultTheme = ${JSON.stringify(defaultTheme)};
    const enableSystem = ${JSON.stringify(enableSystem)};
    const storageKey = ${JSON.stringify(storageKey)};
    const mediaQuery = ${JSON.stringify(THEME_MEDIA_QUERY)};
    const isTheme = (value) => value === "light" || value === "dark" || value === "system";
    const storedTheme = localStorage.getItem(storageKey);
    const selectedTheme = isTheme(storedTheme) ? storedTheme : defaultTheme;
    const resolvedTheme =
      selectedTheme === "system" && enableSystem
        ? window.matchMedia(mediaQuery).matches
          ? "dark"
          : "light"
        : selectedTheme === "system"
          ? ${JSON.stringify(DEFAULT_THEME)}
          : selectedTheme;
    const root = document.documentElement;

    if (attribute === "class") {
      root.classList.toggle("dark", resolvedTheme === "dark");
    } else {
      root.setAttribute(attribute, resolvedTheme);
    }

    root.style.colorScheme = resolvedTheme;
  } catch {}
})();`;
}
