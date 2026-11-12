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
        navy: "#0A2540",
        teal: "#14B8A6",
        carbon: "rgb(var(--lv-bg) / <alpha-value>)",
        panel: "rgb(var(--lv-surface) / <alpha-value>)",
        raised: "rgb(var(--lv-elevated) / <alpha-value>)",
        bone: "rgb(var(--lv-ink) / <alpha-value>)",
        ash: "rgb(var(--lv-muted) / <alpha-value>)",
        iris: "rgb(var(--lv-accent) / <alpha-value>)",
        "paper-ink": "#0F172A",
        "accent-brand": "#14B8A6",
        blocking: "var(--color-blocking)",
        major: "var(--color-major)",
        minor: "var(--color-minor)",
        ok: "var(--color-ok)",
      },
      fontFamily: {
        display: ['"Inter Tight"', '"Jost"', 'sans-serif'],
        sans: ['"Inter"', '"Jost"', 'sans-serif'],
        label: ['"Archivo"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        "lustro-card": "var(--shadow-card)",
        "lustro-white": "var(--shadow-subtle)",
      },
    },
  },
  plugins: [],
};
