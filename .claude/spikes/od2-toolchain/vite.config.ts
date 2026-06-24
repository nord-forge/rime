import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// One config used by BOTH stock vite and rolldown-vite (drop-in compatible).
// The active engine is selected by which package is installed as "vite"
// (see package.json override toggled per build). Output dir is per-engine so
// the two builds can be diffed.
const engine = process.env.TC_ENGINE ?? 'vite';

export default defineConfig({
  build: {
    outDir: `dist/${engine}`,
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'rime-core.js',
    },
    rollupOptions: {
      // Lit is a real peer dep in the lib; externalize it so we measure OUR code,
      // not Lit's runtime (mirrors how @nord-forge/rime-core will ship).
      external: ['lit', /^lit\//],
    },
    reportCompressedSize: true,
    minify: 'esbuild',
  },
});
