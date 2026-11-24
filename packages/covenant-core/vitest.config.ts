import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    environmentMatchGlobs: [["test/tribunal-ui/**", "jsdom"]],
    setupFiles: ["./test/setup-react.ts"],
  },
});
