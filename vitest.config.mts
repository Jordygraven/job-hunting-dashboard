import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {},
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "server-only": path.resolve(import.meta.dirname, "node_modules/server-only/empty.js"),
    },
  },
});
