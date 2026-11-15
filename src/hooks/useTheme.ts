import { useEffect, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

export type ThemePref = "auto" | "light" | "dark";

const KEY = "pulsecal:theme";
const META = { light: "#efe8dc", dark: "#1b1815" };

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

/**
 * Motyw: auto (według systemu) / jasny / ciemny. Ustawia `data-theme` na <html> (CSS w index.css)
 * i kolor paska aplikacji (meta theme-color). Skrypt w index.html ustawia to samo przed startem Reacta,
 * żeby ciemny motyw nie mignął na jasno.
 */
export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(readPref);
  const systemDark = useMediaQuery("(prefers-color-scheme: dark)");
  const resolved: "light" | "dark" = pref === "auto" ? (systemDark ? "dark" : "light") : pref;

  useEffect(() => {
    document.documentElement.dataset.theme = resolved;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[resolved]);
  }, [resolved]);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, pref);
    } catch {
      // prywatny tryb przeglądarki — motyw po prostu nie zostanie zapamiętany
    }
  }, [pref]);

  return { pref, setPref, resolved };
}
