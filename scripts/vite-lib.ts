import { defineConfig, type UserConfig } from "vite";
import { resolve } from "node:path";

// Shared library-build config for the five publishable @nord-forge/* packages.
// rolldown-vite is the decided bundler; stock vite is a drop-in fallback,
// so this config is engine-agnostic. JS is emitted here; .d.ts via `tsc`.
//
// `external` lists peers we must NOT bundle: lit, framework peers, and workspace
// siblings (consumers install them separately). This keeps each package small and
// keeps the core bundle-size measurement honest.
export interface LibOptions {
  /** Absolute path to the package root (pass `import.meta.dirname`). */
  root: string;
  /** Entry file relative to root. Defaults to src/index.ts. */
  entry?: string;
  /**
   * Extra named entry points relative to root (besides the default index),
   * keyed by output basename. E.g. `{ register: "src/register.ts" }` emits
   * dist/register.js. Each becomes its own chunk so consumers import only what
   * they use.
   */
  entries?: Record<string, string>;
  /** Additional externals beyond the always-external Lit/workspace set. */
  external?: (string | RegExp)[];
  /**
   * Build for Node instead of the browser. Externalizes Node built-ins (and
   * their `node:` forms) so a Node-side package (e.g. the MJML renderer, which
   * runs at export time) doesn't bundle/polyfill them.
   */
  node?: boolean;
}

const ALWAYS_EXTERNAL: (string | RegExp)[] = ["lit", /^lit\//, /^@lit\//, /^@nord-forge\//];

// Node built-ins to externalize in node-target builds (both bare and node: form).
const NODE_BUILTINS =
  /^(node:)?(fs|path|os|util|stream|events|crypto|url|http|https|zlib|buffer|child_process|module|assert)$/;

export function libConfig(opts: LibOptions): UserConfig {
  const entry: Record<string, string> = {
    index: resolve(opts.root, opts.entry ?? "src/index.ts"),
  };
  for (const [name, file] of Object.entries(opts.entries ?? {})) {
    entry[name] = resolve(opts.root, file);
  }
  const external = [...ALWAYS_EXTERNAL, ...(opts.external ?? [])];
  if (opts.node) external.push(NODE_BUILTINS);

  return defineConfig({
    // Resolve workspace siblings (@nord-forge/*) from their TS source during dev
    // serve — the Playwright e2e harness is served by `vite` with no prior build,
    // so the packages have no dist/ yet. The "development"/"source" conditions map
    // to ./src/index.ts in each package's exports. (Library builds externalize
    // these siblings, so this only matters when serving.)
    resolve: {
      conditions: ["development", "source", "import", "module", "browser", "default"],
    },
    build: {
      outDir: resolve(opts.root, "dist"),
      emptyOutDir: true,
      lib: {
        entry,
        formats: ["es"],
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      rollupOptions: {
        external,
      },
      reportCompressedSize: true,
      // "oxc" is rolldown-vite's native minifier (no separate esbuild install).
      // Stock-vite fallback understands the same value via its esbuild path.
      minify: "oxc",
      target: opts.node ? "node18" : "es2022",
    },
    // Resolve to the Node entry points of dependencies in node-target builds.
    ...(opts.node ? { ssr: { target: "node" as const } } : {}),
  });
}
