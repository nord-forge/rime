import { defineConfig } from "vite";

// Demo app (app mode, not library). Fleshed out later into the full
// end-user UX showcase; for now it just needs to build and run.
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
