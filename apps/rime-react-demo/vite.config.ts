import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// React demo app (app mode). Proves the @nord-forge/rime-react wrapper in a real app.
export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist", emptyOutDir: true },
});
