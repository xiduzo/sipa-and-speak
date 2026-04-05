# Bugfix Requirements Document

## Introduction

The mobile app (React Native / Expo) does not reflect the "Barista Blend" design theme. The CSS in `apps/native/global.css` defines design tokens under `--color-brand-*` custom properties and exposes them via `@theme inline` as `brand-*` Tailwind utilities. However, every screen and component in the app uses standard Tailwind semantic class names (`bg-primary`, `text-foreground`, `bg-muted`, `text-muted-foreground`, `bg-background`, `border-border`, `text-primary-foreground`, etc.) which are not mapped to the brand tokens. As a result, the Barista Blend colors (Burnt Orange, Teal, Coffee Brown, Warm Gray, warm cream background, etc.) never appear in the UI.

Additionally, the custom fonts (Plus Jakarta Sans for headlines, Manrope for body text) are loaded in `_layout.tsx` via `useFonts` but are never wired into CSS font-family definitions or Tailwind font utilities, so all text renders in system default fonts.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN any screen renders elements using `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-background`, `text-foreground`, `border-border`, or other standard Tailwind semantic color classes THEN the system displays default/fallback colors instead of the Barista Blend palette because the CSS custom properties `--color-primary`, `--color-background`, `--color-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-border`, etc. are not defined — only `--color-brand-*` variants exist

1.2 WHEN any screen renders text using headline or body typography THEN the system displays text in the device's system default font instead of Plus Jakarta Sans (headlines) or Manrope (body), because the loaded fonts are not mapped to any CSS `font-family` or Tailwind `font-*` utility classes

1.3 WHEN the `@theme inline` block in `global.css` is processed THEN the system only generates `brand-*` prefixed Tailwind utilities (e.g., `bg-brand-primary`, `text-brand-foreground`) which no component actually uses, leaving the brand tokens effectively orphaned

### Expected Behavior (Correct)

2.1 WHEN any screen renders elements using `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-background`, `text-foreground`, `border-border`, and other standard Tailwind semantic color classes THEN the system SHALL display the Barista Blend colors (Primary: #D85C27, Secondary: #008080, Tertiary: #5D4037, Neutral: #6F605B, Background: #FFF8F3, Foreground: #2C1810, Muted: #F5E6DA, Muted Foreground: #6F605B, Border: #E8D5C4, Accent: #D4A574, Primary Foreground: #FFFFFF, Secondary Foreground: #FFFFFF) by mapping the brand token values to the standard semantic CSS custom properties (`--color-primary`, `--color-background`, `--color-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-border`, etc.)

2.2 WHEN any screen renders headline text THEN the system SHALL use Plus Jakarta Sans as the font family, and WHEN any screen renders body text THEN the system SHALL use Manrope as the font family, by defining appropriate `--font-*` CSS custom properties and/or `@theme` font-family entries that map to the loaded font assets

2.3 WHEN the `@theme inline` block in `global.css` is processed THEN the system SHALL expose the Barista Blend tokens under the standard semantic Tailwind utility names (e.g., `--color-primary`, `--color-background`, `--color-foreground`, `--color-muted`, `--color-muted-foreground`, `--color-border`, `--color-accent`) so that existing component classes resolve to the correct brand colors without any component code changes

### Unchanged Behavior (Regression Prevention)

3.1 WHEN any screen or component uses non-theme-related Tailwind utility classes (e.g., layout utilities like `flex-1`, `p-4`, `gap-3`, `rounded-full`, spacing, sizing) THEN the system SHALL CONTINUE TO render those utilities correctly without any change in behavior

3.2 WHEN the app loads fonts via `useFonts` in `_layout.tsx` THEN the system SHALL CONTINUE TO load Plus Jakarta Sans and Manrope font assets and gate rendering behind the splash screen until fonts are ready

3.3 WHEN the `AppThemeProvider` toggles between light and dark themes THEN the system SHALL CONTINUE TO support theme switching, with the Barista Blend tokens applying to the appropriate theme context

3.4 WHEN heroui-native components (Button, Card, Spinner, Surface, etc.) are rendered THEN the system SHALL CONTINUE TO function correctly, now inheriting the Barista Blend colors through the standard semantic CSS custom properties they rely on

3.5 WHEN the `brand-*` prefixed CSS custom properties and Tailwind utilities are defined in `global.css` THEN the system SHALL CONTINUE TO make them available for any future or explicit use, without removing or breaking the existing `--color-brand-*` token definitions
