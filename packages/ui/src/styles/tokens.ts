/**
 * Barista Blend – Design System Tokens
 *
 * Shared token values for use in JS/TS contexts (e.g. React Native StyleSheet,
 * charting libraries, or anywhere CSS custom properties aren't available).
 */

export const colors = {
  primary: {
    DEFAULT: "#D85C27",
    foreground: "#FFFFFF",
  },
  secondary: {
    DEFAULT: "#008080",
    foreground: "#FFFFFF",
  },
  tertiary: {
    DEFAULT: "#5D4037",
    foreground: "#F5E6DA",
  },
  neutral: {
    DEFAULT: "#6F605B",
    foreground: "#FFFFFF",
  },
  background: "#FFF8F3",
  foreground: "#2C1810",
  muted: {
    DEFAULT: "#F5E6DA",
    foreground: "#6F605B",
  },
  accent: "#D4A574",
  border: "#E8D5C4",
  destructive: "#E53935",
} as const;

export const darkColors = {
  primary: {
    DEFAULT: "#E87A4A",
    foreground: "#1A0F0A",
  },
  secondary: {
    DEFAULT: "#26A6A6",
    foreground: "#1A0F0A",
  },
  tertiary: {
    DEFAULT: "#8B7355",
    foreground: "#F5E6DA",
  },
  neutral: {
    DEFAULT: "#8B7355",
    foreground: "#FFFFFF",
  },
  background: "#1A0F0A",
  foreground: "#F5E6DA",
  muted: {
    DEFAULT: "#3D2B1F",
    foreground: "#8B7355",
  },
  accent: "#3D2B1F",
  border: "#3D2B1F",
  destructive: "#EF5350",
} as const;

export const fonts = {
  heading: "Plus Jakarta Sans",
  body: "Manrope",
  label: "Manrope",
} as const;

export const fontFamilies = {
  native: {
    heading: {
      medium: "PlusJakartaSans_500Medium",
      semiBold: "PlusJakartaSans_600SemiBold",
      bold: "PlusJakartaSans_700Bold",
      extraBold: "PlusJakartaSans_800ExtraBold",
    },
    body: {
      regular: "Manrope_400Regular",
      medium: "Manrope_500Medium",
      semiBold: "Manrope_600SemiBold",
      bold: "Manrope_700Bold",
    },
  },
} as const;

export const radii = {
  sm: 8,
  md: 10,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;
