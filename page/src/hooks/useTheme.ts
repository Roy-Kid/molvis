import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "molvis-theme";
const DEFAULT_THEME: Theme = "dark";

function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return DEFAULT_THEME;
}

function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
  root.style.colorScheme = theme;
}

/** Call once before React hydrates to avoid a flash of the wrong theme. */
export function bootstrapTheme(): void {
  applyTheme(readStoredTheme());
}

/** Emits a `molvis:theme-change` CustomEvent so non-React code (canvas) can react. */
function emitThemeChange(theme: Theme): void {
  window.dispatchEvent(
    new CustomEvent<Theme>("molvis:theme-change", { detail: theme }),
  );
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());

  const setTheme = useCallback((next: Theme) => {
    applyTheme(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {}
    emitThemeChange(next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      const next = readStoredTheme();
      applyTheme(next);
      setThemeState(next);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return { theme, setTheme, toggleTheme, isDark: theme === "dark" };
}
