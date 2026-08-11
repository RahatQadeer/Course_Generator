import type { CSSProperties } from "react";

/**
 * Course presentation themes.
 *
 * A theme is a flat set of CSS variables applied to the `.course-theme` root.
 * Everything the preview renders reads from these — no per-theme components.
 */

export type CardStyle = "elevated" | "outlined" | "flat" | "accent-bar";

export type CourseTheme = {
  id: string;
  name: string;
  description: string;
  /** Swatches shown in the theme picker. */
  swatch: [string, string, string];
  dark: boolean;
  tokens: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    text: string;
    heading: string;
    muted: string;
    line: string;
    primary: string;
    primaryContrast: string;
    accent: string;
    accentSoft: string;
    radius: string;
    fontHeading: string;
    fontBody: string;
    fontMono: string;
    headingTracking: string;
    cardStyle: CardStyle;
    headerStyle: "gradient" | "solid" | "bordered" | "minimal";
  };
};

const SANS = "var(--font-sans-app), ui-sans-serif, system-ui, sans-serif";
const SERIF = "var(--font-serif-app), Georgia, 'Times New Roman', serif";
const MONO = "var(--font-mono-app), ui-monospace, SFMono-Regular, monospace";

export const THEMES: CourseTheme[] = [
  {
    id: "modern",
    name: "Modern",
    description: "Clean, spacious, product-grade.",
    swatch: ["#4f7796", "#f4f4f2", "#16181c"],
    dark: false,
    tokens: {
      bg: "#f6f7f8",
      surface: "#ffffff",
      surfaceAlt: "#f9fafb",
      text: "#22262c",
      heading: "#101316",
      muted: "#6c737c",
      line: "#e5e7eb",
      primary: "#3f6f95",
      primaryContrast: "#ffffff",
      accent: "#2f7d5d",
      accentSoft: "#eaf1f6",
      radius: "12px",
      fontHeading: SANS,
      fontBody: SANS,
      fontMono: MONO,
      headingTracking: "-0.02em",
      cardStyle: "elevated",
      headerStyle: "gradient",
    },
  },
  {
    id: "academic",
    name: "Academic",
    description: "Serif typography, scholarly and calm.",
    swatch: ["#7c3f2e", "#fbf8f3", "#2c2620"],
    dark: false,
    tokens: {
      bg: "#fbf8f3",
      surface: "#ffffff",
      surfaceAlt: "#f7f2e9",
      text: "#332c24",
      heading: "#1f1a15",
      muted: "#7a6f61",
      line: "#e6ddcd",
      primary: "#7c3f2e",
      primaryContrast: "#ffffff",
      accent: "#4a6741",
      accentSoft: "#f2ebdf",
      radius: "4px",
      fontHeading: SERIF,
      fontBody: SERIF,
      fontMono: MONO,
      headingTracking: "-0.005em",
      cardStyle: "outlined",
      headerStyle: "bordered",
    },
  },
  {
    id: "corporate",
    name: "Corporate",
    description: "Confident navy, structured and formal.",
    swatch: ["#13315c", "#eef1f5", "#0b1727"],
    dark: false,
    tokens: {
      bg: "#eef1f5",
      surface: "#ffffff",
      surfaceAlt: "#f5f7fa",
      text: "#1f2a37",
      heading: "#0b1727",
      muted: "#62707f",
      line: "#dbe2ea",
      primary: "#13315c",
      primaryContrast: "#ffffff",
      accent: "#b8860b",
      accentSoft: "#e8edf4",
      radius: "6px",
      fontHeading: SANS,
      fontBody: SANS,
      fontMono: MONO,
      headingTracking: "-0.01em",
      cardStyle: "accent-bar",
      headerStyle: "solid",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    description: "Monochrome, quiet, text-first.",
    swatch: ["#111111", "#ffffff", "#666666"],
    dark: false,
    tokens: {
      bg: "#ffffff",
      surface: "#ffffff",
      surfaceAlt: "#fafafa",
      text: "#262626",
      heading: "#0a0a0a",
      muted: "#8a8a8a",
      line: "#ebebeb",
      primary: "#111111",
      primaryContrast: "#ffffff",
      accent: "#111111",
      accentSoft: "#f4f4f4",
      radius: "2px",
      fontHeading: SANS,
      fontBody: SANS,
      fontMono: MONO,
      headingTracking: "-0.025em",
      cardStyle: "flat",
      headerStyle: "minimal",
    },
  },
  {
    id: "technology",
    name: "Technology",
    description: "Cool indigo with a code-forward feel.",
    swatch: ["#4f46e5", "#f5f6ff", "#1b1b2f"],
    dark: false,
    tokens: {
      bg: "#f5f6ff",
      surface: "#ffffff",
      surfaceAlt: "#f0f1fe",
      text: "#26263c",
      heading: "#14142b",
      muted: "#6a6a85",
      line: "#e2e3f5",
      primary: "#4f46e5",
      primaryContrast: "#ffffff",
      accent: "#0891b2",
      accentSoft: "#eceafe",
      radius: "10px",
      fontHeading: SANS,
      fontBody: SANS,
      fontMono: MONO,
      headingTracking: "-0.02em",
      cardStyle: "outlined",
      headerStyle: "gradient",
    },
  },
  {
    id: "creative",
    name: "Creative",
    description: "Warm coral, generous curves.",
    swatch: ["#e0553f", "#fff8f4", "#2b1b16"],
    dark: false,
    tokens: {
      bg: "#fff8f4",
      surface: "#ffffff",
      surfaceAlt: "#fff1e9",
      text: "#33241f",
      heading: "#231512",
      muted: "#8a6f65",
      line: "#f3ded2",
      primary: "#e0553f",
      primaryContrast: "#ffffff",
      accent: "#8b5cf6",
      accentSoft: "#ffeee6",
      radius: "18px",
      fontHeading: SANS,
      fontBody: SANS,
      fontMono: MONO,
      headingTracking: "-0.025em",
      cardStyle: "elevated",
      headerStyle: "gradient",
    },
  },
  {
    id: "dark",
    name: "Dark",
    description: "Low-light reading, high contrast.",
    swatch: ["#6ea8d8", "#15181d", "#e8eaed"],
    dark: true,
    tokens: {
      bg: "#101317",
      surface: "#171b21",
      surfaceAlt: "#1d222a",
      text: "#d7dbe0",
      heading: "#f2f4f7",
      muted: "#8b939e",
      line: "#272d36",
      primary: "#6ea8d8",
      primaryContrast: "#0d1116",
      accent: "#67c39a",
      accentSoft: "#1c2530",
      radius: "10px",
      fontHeading: SANS,
      fontBody: SANS,
      fontMono: MONO,
      headingTracking: "-0.02em",
      cardStyle: "outlined",
      headerStyle: "solid",
    },
  },
];

export const DEFAULT_THEME_ID = "modern";

export function getTheme(themeId: string | undefined): CourseTheme {
  return THEMES.find((theme) => theme.id === themeId) ?? THEMES[0];
}

/** Theme overrides a user can tweak without opening a full editor. */
export type ThemeOverrides = {
  primary?: string;
  accent?: string;
  font?: "sans" | "serif" | "mono";
  radius?: number;
  cardStyle?: CardStyle;
};

function cardCss(style: CardStyle, line: string, dark: boolean) {
  switch (style) {
    case "outlined":
      return { border: `1px solid ${line}`, shadow: "none" };
    case "flat":
      return { border: "1px solid transparent", shadow: "none" };
    case "accent-bar":
      return { border: `1px solid ${line}`, shadow: "none" };
    case "elevated":
    default:
      return {
        border: `1px solid ${line}`,
        shadow: dark
          ? "0 1px 2px rgb(0 0 0/0.4), 0 12px 32px -20px rgb(0 0 0/0.8)"
          : "0 1px 2px rgb(16 24 40/0.04), 0 12px 32px -20px rgb(16 24 40/0.28)",
      };
  }
}

/** Build the inline style object applied to a `.course-theme` element. */
export function themeStyle(
  theme: CourseTheme,
  overrides: ThemeOverrides = {},
): CSSProperties {
  const t = theme.tokens;
  const primary = overrides.primary || t.primary;
  const accent = overrides.accent || t.accent;
  const radius = overrides.radius !== undefined ? `${overrides.radius}px` : t.radius;
  const cardStyle = overrides.cardStyle ?? t.cardStyle;
  const body =
    overrides.font === "serif" ? SERIF : overrides.font === "mono" ? MONO : overrides.font === "sans" ? SANS : t.fontBody;
  const heading = overrides.font ? body : t.fontHeading;
  const card = cardCss(cardStyle, t.line, theme.dark);

  return {
    "--ct-bg": t.bg,
    "--ct-surface": t.surface,
    "--ct-surface-alt": t.surfaceAlt,
    "--ct-text": t.text,
    "--ct-heading": t.heading,
    "--ct-muted": t.muted,
    "--ct-line": t.line,
    "--ct-primary": primary,
    "--ct-primary-contrast": t.primaryContrast,
    "--ct-accent": accent,
    "--ct-accent-soft": t.accentSoft,
    "--ct-radius": radius,
    "--ct-font-heading": heading,
    "--ct-font-body": body,
    "--ct-font-mono": t.fontMono,
    "--ct-heading-tracking": t.headingTracking,
    "--ct-card-border": card.border,
    "--ct-card-shadow": card.shadow,
    "--ct-card-style": cardStyle,
    "--ct-header-style": t.headerStyle,
  } as CSSProperties;
}

/** Same tokens, serialised for the standalone HTML export. */
export function themeCssVars(theme: CourseTheme, overrides: ThemeOverrides = {}): string {
  const style = themeStyle(theme, overrides) as Record<string, string>;
  return Object.entries(style)
    .filter(([key]) => key.startsWith("--"))
    .map(([key, value]) => `  ${key}: ${value};`)
    .join("\n");
}
