import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#eef2ff",
          100: "#e0e7ff",
          200: "#c7d2fe",
          400: "#818cf8",
          500: "#6366f1", // Indigo
          600: "#4f46e5",
          700: "#4338ca",
          900: "#312e81",
        },
        glass: {
          light: "rgba(255, 255, 255, 0.6)",
          dark: "rgba(15, 23, 42, 0.4)",
          borderLight: "rgba(255, 255, 255, 0.2)",
          borderDark: "rgba(255, 255, 255, 0.08)",
        }
      },
      boxShadow: {
        glass: "0 8px 32px 0 rgba(0, 0, 0, 0.15)",
        "glass-dark": "0 8px 32px 0 rgba(0, 0, 0, 0.4)",
        glow: "0 0 24px rgba(99, 102, 241, 0.4)",
        "glow-sm": "0 0 10px rgba(99, 102, 241, 0.2)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(10px)" },
          to:   { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to:   { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "fade-up":  "fade-up 0.35s ease both",
        "scale-in": "scale-in 0.25s ease both",
      },
    },
  },
  plugins: [],
};

export default config;
