// Guard: the pure SDK barrel ("@nord-forge/rime-core" → src/index.ts) and the editor
// entry ("@nord-forge/rime-core/register" → src/register.ts) must NEVER reach Lexical
// through STATIC imports. Lexical is pulled in only via the dynamic
// `await import(".../lexical-provider")` split, so `lexicalEditor: false` builds and
// `import "@nord-forge/rime-core"` stay Lexical-free.
//
// Unlike no-static-lexical.test.ts (which scans one file's import lines), this walks
// the transitive static-import graph FROM SOURCE — so co-locating a Lexical import
// anywhere reachable from these entries fails here. ENV-66 added this after the
// barrel was found dragging ~57 kB of Lexical into the eager closure behind a green
// total-size gate.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = fileURLToPath(new URL(".", import.meta.url));

// Resolve a relative import specifier to a .ts file on disk (handles `./x`,
// `./x.ts`, and `./dir` → `./dir/index.ts`).
function resolveModule(fromFile: string, spec: string): string | null {
  const base = resolve(dirname(fromFile), spec);
  for (const cand of [base, `${base}.ts`, resolve(base, "index.ts")]) {
    if (existsSync(cand) && cand.endsWith(".ts")) return cand;
  }
  return null;
}

const STATIC_RELATIVE_IMPORT = /(?:^|[^(])\b(?:import|export)[^;]*?\bfrom\s*"(\.\.?\/[^"]+)"/g;
const STATIC_BARE_IMPORT =
  /(?:^|[^(])\b(?:import|export)[^;]*?\bfrom\s*"((?:@lexical\/[^"]+|lexical))"/g;

/** Transitive static-import closure of an entry .ts file. Returns the set of
 *  visited source files, and any file that statically imports the Lexical engine. */
function staticClosure(entry: string): { files: Set<string>; lexicalImporters: string[] } {
  const files = new Set<string>();
  const lexicalImporters: string[] = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (files.has(file)) continue;
    files.add(file);
    const src = readFileSync(file, "utf8");

    // Does THIS file statically import lexical / @lexical/*?
    if (new RegExp(STATIC_BARE_IMPORT.source, "g").test(src)) {
      lexicalImporters.push(file.slice(SRC.length));
    }

    // Follow relative static imports (skip dynamic import("...") boundaries).
    const re = new RegExp(STATIC_RELATIVE_IMPORT.source, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
      const resolved = resolveModule(file, m[1]!);
      if (resolved) queue.push(resolved);
    }
  }
  return { files, lexicalImporters };
}

describe("Lexical never loads eagerly from the public entries", () => {
  for (const entry of ["index.ts", "register.ts"]) {
    test(`${entry} has no static Lexical import in its transitive closure`, () => {
      const { lexicalImporters } = staticClosure(resolve(SRC, entry));
      expect(lexicalImporters).toEqual([]);
    });
  }

  test("the richtext deep entry IS allowed to reach Lexical (sanity: the walker works)", () => {
    const { lexicalImporters } = staticClosure(resolve(SRC, "richtext.ts"));
    expect(lexicalImporters.length).toBeGreaterThan(0);
  });
});

describe("side-effect entries are declared (custom-element registrations survive)", () => {
  // richtext.ts re-exports element classes whose modules customElements.define() at
  // top level; both register.* and richtext.* must be in sideEffects so importing a
  // single value from them doesn't let the registrations be tree-shaken away.
  const pkg = JSON.parse(readFileSync(resolve(SRC, "..", "package.json"), "utf8")) as {
    sideEffects: string[];
  };

  for (const entry of [
    "./src/register.ts",
    "./dist/register.js",
    "./src/richtext.ts",
    "./dist/richtext.js",
  ]) {
    test(`${entry} is listed in sideEffects`, () => {
      expect(pkg.sideEffects).toContain(entry);
    });
  }
});
