import { defineConfig } from "vite";

// Minimal vanilla embedding example (app mode). Proves the README snippet runs
// against the real @nord-forge/rime-core.
export default defineConfig({
  build: { outDir: "dist", emptyOutDir: true },
});
