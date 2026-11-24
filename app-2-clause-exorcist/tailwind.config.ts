import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        obsidian: "#090c0e",
        vellum: "#f5e9cb",
        wax: "#a51f32",
        mahogany: "#321719",
      },
    },
  },
  plugins: [],
} satisfies Config;
