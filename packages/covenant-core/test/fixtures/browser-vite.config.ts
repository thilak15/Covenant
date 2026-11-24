import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDirectory = dirname(fileURLToPath(import.meta.url));

export default {
  resolve: {
    alias: {
      "@covenant/core": resolve(fixtureDirectory, "../../src/index.ts"),
    },
  },
  build: {
    lib: {
      entry: resolve(fixtureDirectory, "browser-entry.ts"),
      formats: ["es"],
      fileName: "browser-entry",
    },
    minify: false,
    sourcemap: true,
  },
};
