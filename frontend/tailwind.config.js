/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  corePlugins: { preflight: false },
  safelist: [
    "lv-btn-primary", "lv-btn-secondary", "lv-btn-ghost", "lv-btn-danger",
    "lv-badge-neutral", "lv-badge-success", "lv-badge-warning", "lv-badge-danger", "lv-badge-accent",
    "lv-notice-neutral", "lv-notice-success", "lv-notice-warning", "lv-notice-danger", "lv-notice-accent",
    "lv-text-success", "lv-text-warning", "lv-text-danger", "lv-text-accent",
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--lv-ink) / <alpha-value>)",
        muted: "rgb(var(--lv-muted) / <alpha-value>)",
        "muted-foreground": "rgb(var(--lv-muted) / <alpha-value>)",
        surface: "rgb(var(--lv-surface) / <alpha-value>)",
        well: "rgb(var(--lv-well) / <alpha-value>)",
        line: "rgb(var(--lv-line) / <alpha-value>)",
        carbon: "#0c0c0e",
        panel: "#17171a",
        raised: "#212126",
        bone: "#edebe6",
        ash: "#9b9aa1",
        iris: "#a39cff",
        "paper-ink": "#0c0c0e",
        "accent-brand": "#4b3fd1",
        blocking: "#ff6a5c",
        major: "#f0a03c",
        minor: "#74a7f0",
        ok: "#3dc48a",
      },
      fontFamily: {
        display: ['"Jost"', 'sans-serif'],
        sans: ['"Jost"', 'sans-serif'],
        label: ['"Archivo"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        "lustro-card": "0 12px 48px -24px rgba(0,0,0,.7), inset 0 1px rgba(255,255,255,.025)",
        "lustro-white": "0 3px 18px rgba(255,255,255,.08)",
      },
    },
  },
  plugins: [],
};
