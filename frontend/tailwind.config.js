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
        surface: "rgb(var(--lv-surface) / <alpha-value>)",
        well: "rgb(var(--lv-well) / <alpha-value>)",
        line: "rgb(var(--lv-line) / <alpha-value>)",
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'Inter', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
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
