import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "circulo-theme";
const DEFAULT_THEME = "tinta";

const FAVICONS = {
  tinta: "/favicon.svg",
  grafito: "/favicon-grafito.svg",
  arcilla: "/favicon-arcilla.svg",
};

const THEME_COLORS = {
  tinta: "#f7f8fa",
  grafito: "#1d1f23",
  arcilla: "#f6f1e8",
};

export const themes = [
  { id: "tinta", name: "Tinta", description: "Claro, azul cobalto. Predeterminado." },
  { id: "grafito", name: "Grafito", description: "Oscuro, ámbar sobre carbón." },
  { id: "arcilla", name: "Arcilla", description: "Crema cálido, terracota." },
];

const isValidTheme = (id) => themes.some((t) => t.id === id);

const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isValidTheme(saved) ? saved : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;

    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.setAttribute("href", FAVICONS[theme] || FAVICONS.tinta);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.tinta);
    }
  }, [theme]);

  const setTheme = useCallback((id) => {
    if (!isValidTheme(id)) return;
    setThemeState(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* almacenamiento no disponible: el tema aplica solo en la sesión */
    }
  }, []);

  const value = useMemo(() => ({ theme, setTheme, themes }), [theme, setTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de ThemeProvider");
  return ctx;
}
