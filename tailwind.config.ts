import type { Config } from "tailwindcss";

/*
 * Color tokens are OKLCH component triples (lightness, chroma, hue)
 * stored in `src/app/globals.css`. We compose them here via
 * `oklch(var(--token) / <alpha-value>)` so Tailwind's `/XX` alpha syntax
 * (e.g. `bg-primary/10`) continues to work. See `.impeccable.md` for
 * palette semantics.
 */
const token = (name: string) => `oklch(var(--${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
      },
      colors: {
        background: token("background"),
        foreground: token("foreground"),
        card: {
          DEFAULT: token("card"),
          foreground: token("card-foreground"),
        },
        popover: {
          DEFAULT: token("popover"),
          foreground: token("popover-foreground"),
        },
        primary: {
          DEFAULT: token("primary"),
          foreground: token("primary-foreground"),
        },
        secondary: {
          DEFAULT: token("secondary"),
          foreground: token("secondary-foreground"),
        },
        muted: {
          DEFAULT: token("muted"),
          foreground: token("muted-foreground"),
        },
        accent: {
          DEFAULT: token("accent"),
          foreground: token("accent-foreground"),
        },
        destructive: {
          DEFAULT: token("destructive"),
          foreground: token("destructive-foreground"),
        },
        warm: {
          DEFAULT: token("warm"),
          foreground: token("warm-foreground"),
        },
        peach: {
          DEFAULT: token("accent-peach"),
          foreground: token("accent-peach-foreground"),
        },
        border: token("border"),
        input: token("input"),
        ring: token("ring"),
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;
