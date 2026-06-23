import { defineConfig, type UserConfig } from "vite";
import { resolve } from "node:path";

// Shared library-build config for the five publishable @enveloppe/* packages.
// rolldown-vite is the decided bundler (ENV-02); stock vite is a drop-in fallback,
// so this config is engine-agnostic. JS is emitted here; .d.ts via `tsc` (ENV-01).
//
// `external` lists peers we must NOT bundle: lit, framework peers, and workspace
// siblings (consumers install them separately). This keeps each package small and
// keeps the core bundle-size measurement honest.
export interface LibOptions {
  /** Absolute path to the package root (pass `import.meta.dirname`). */
  root: string;
  /** Entry file relative to root. Defaults to src/index.ts. */
  entry?: string;
  /** Additional externals beyond the always-external Lit/workspace set. */
  external?: (string | RegExp)[];
}

const ALWAYS_EXTERNAL: (string | RegExp)[] = ["lit", /^lit\//, /^@lit\//, /^@enveloppe\//];

export function libConfig(opts: LibOptions): UserConfig {
  const entry = resolve(opts.root, opts.entry ?? "src/index.ts");
  return defineConfig({
    build: {
      outDir: resolve(opts.root, "dist"),
      emptyOutDir: true,
      lib: {
        entry,
        formats: ["es"],
        fileName: () => "index.js",
      },
      rollupOptions: {
        external: [...ALWAYS_EXTERNAL, ...(opts.external ?? [])],
      },
      reportCompressedSize: true,
      // "oxc" is rolldown-vite's native minifier (no separate esbuild install).
      // Stock-vite fallback understands the same value via its esbuild path.
      minify: "oxc",
      target: "es2022",
    },
  });
}
