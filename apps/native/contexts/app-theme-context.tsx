import React, { createContext, useCallback, useContext, useMemo } from "react";
import { Appearance } from "react-native";
import { Uniwind } from "uniwind";

type ThemeName = "light" | "dark";

// App is light-mode only for now. Uniwind seeds its theme from the OS color
// scheme at startup, and HeroUI follows uniwind's theme — so on OS-dark
// devices `dark:` variants would still activate unless we force light here.
// Runs at import time (this module is pulled in by the root _layout).
Appearance.setColorScheme("light");
Uniwind.setTheme("light");

type AppThemeContextType = {
  currentTheme: string;
  isLight: boolean;
  isDark: boolean;
  setTheme: (theme: ThemeName) => void;
  toggleTheme: () => void;
};

const AppThemeContext = createContext<AppThemeContextType | undefined>(
  undefined,
);

export const AppThemeProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Light-mode only for now — theme switching is intentionally disabled.
  const theme = "light" as ThemeName;
  const isLight = true;
  const isDark = false;

  // No-ops while the app is locked to light. Keep the API so callers compile;
  // re-assert light in case any consumer still calls these.
  const setTheme = useCallback((_newTheme: ThemeName) => {
    Uniwind.setTheme("light");
  }, []);

  const toggleTheme = useCallback(() => {
    Uniwind.setTheme("light");
  }, []);

  const value = useMemo(
    () => ({
      currentTheme: theme,
      isLight,
      isDark,
      setTheme,
      toggleTheme,
    }),
    [theme, isLight, isDark, setTheme, toggleTheme],
  );

  return (
    <AppThemeContext.Provider value={value}>
      {children}
    </AppThemeContext.Provider>
  );
};

export function useAppTheme() {
  const context = useContext(AppThemeContext);
  if (!context) {
    throw new Error("useAppTheme must be used within AppThemeProvider");
  }
  return context;
}
