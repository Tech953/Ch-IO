/**
 * Semantic design tokens for ENGRAM Mobile.
 *
 * Synced from the sibling web artifact (`artifacts/engram/src/index.css`).
 * The web app forces a single dark cyberpunk-cyan theme, so both the `light`
 * and `dark` palettes below are identical — the app always renders dark
 * regardless of the device appearance setting.
 */

const palette = {
  // Legacy aliases (kept for backward compatibility)
  text: "#f8fafc",
  tint: "#0dccf2",

  // Core surfaces
  background: "#040610",
  foreground: "#f8fafc",

  // Cards / elevated surfaces
  card: "#090c1b",
  cardForeground: "#f8fafc",

  // Primary action color (cyan)
  primary: "#0dccf2",
  primaryForeground: "#021018",

  // Secondary / less-emphasis interactive surfaces
  secondary: "#131a39",
  secondaryForeground: "#9eebfa",

  // Muted / subdued elements (dividers, timestamps, placeholders)
  muted: "#0f142e",
  mutedForeground: "#7a99b8",

  // Accent highlights (amber)
  accent: "#f4af25",
  accentForeground: "#1a1203",

  // Destructive actions
  destructive: "#ef4343",
  destructiveForeground: "#ffffff",

  // Borders and input outlines
  border: "#131a39",
  input: "#131a39",

  // Extra brand tokens
  ring: "#0dccf2",
  success: "#33cc80",
  violet: "#7e47eb",
};

const colors = {
  light: palette,
  radius: 8,
};

export default colors;
