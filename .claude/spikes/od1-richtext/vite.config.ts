import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// One config, three targets via ENGINE env var: baseline | tiptap | lexical.
// Library mode, ESM, minified — mirrors how @nord-forge/rime-core will ship, so the
// reported sizes are representative (not dev-server sizes).
const engine = process.env.ENGINE ?? 'tiptap';
const entry = resolve(__dirname, `src/entry.${engine}.ts`);

export default defineConfig({
  build: {
    outDir: `dist/${engine}`,
    emptyOutDir: true,
    minify: 'esbuild',
    lib: {
      entry,
      formats: ['es'],
      fileName: () => `${engine}.js`,
    },
    rollupOptions: {
      // Bundle everything (no externals) so the chunk reflects total shipped weight.
      output: { inlineDynamicImports: true },
    },
    reportCompressedSize: true,
  },
});
