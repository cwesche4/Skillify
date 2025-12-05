// tailwind.config.ts
import type { Config } from "tailwindcss"
import animate from "tailwindcss-animate"

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],

  theme: {
    extend: {
      /* --------------------------------------------------------
         COLOR TOKENS (reads directly from CSS vars in globals.css)
      --------------------------------------------------------- */
      colors: {
        brand: {
          primary: "var(--brand-primary)",
          indigo: "var(--brand-indigo)",
          teal: "var(--brand-teal)",
        },

        neutral: {
          light: "var(--neutral-light)",
          dark: "var(--neutral-dark)",
          cardLight: "var(--neutral-card-light)",
          cardDark: "var(--neutral-card-dark)",
          border: "var(--neutral-border)",
          textPrimary: "var(--neutral-text-primary)",
          textSecondary: "var(--neutral-text-secondary)",
        },

        accent: {
          softPurple: "var(--accent-soft-purple)",
          skyBlue: "var(--accent-sky-blue)",
          mint: "var(--accent-mint)",
        },

        // OPTIONAL: semantic colors wired for utilities
        semantic: {
          success: "#22c55e",
          warning: "#facc15",
          danger: "#ef4444",
          info: "#0ea5e9",
        },
      },

      /* --------------------------------------------------------
         TYPOGRAPHY
      --------------------------------------------------------- */
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui"],
        heading: ["Plus Jakarta Sans", "ui-sans-serif"],
        mono: [
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Monaco",
          "Consolas",
          "Liberation Mono",
          "Courier New",
          "monospace",
        ],
      },

      /* --------------------------------------------------------
         RADII & SHADOWS
      --------------------------------------------------------- */
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
        "3xl": "2rem",
      },

      boxShadow: {
        soft: "0 4px 12px rgba(0,0,0,0.15)",
        card: "0 8px 30px rgba(0,0,0,0.25)",
        glowIndigo: "0 0 20px rgba(99,102,241,0.6)",
        focus: "0 0 0 1px rgba(37,99,235,0.8)",
      },

      /* --------------------------------------------------------
         SPACING + LAYOUT TOKENS
      --------------------------------------------------------- */
      spacing: {
        xs: "4px",
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "24px",
        "2xl": "32px",
        "3xl": "40px",
      },

      /* --------------------------------------------------------
         GRID HELPERS
      --------------------------------------------------------- */
      gridTemplateColumns: {
        "auto-2": "repeat(2, minmax(0, 1fr))",
        "auto-3": "repeat(3, minmax(0, 1fr))",
        "auto-4": "repeat(4, minmax(0, 1fr))",
      },
    },
  },

  plugins: [animate],
}

export default config