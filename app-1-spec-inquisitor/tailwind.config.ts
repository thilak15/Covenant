import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#090c0e",
        vellum: "#f5e9cb",
        brass: "#b69355",
        phosphor: "#79e6aa",
      },
    },
  },
  plugins: [],
} satisfies Config;
