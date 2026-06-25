import { brotliCompressSync, gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Bundle-size gate. Reports @nord-forge/rime-core's shipped size (Lit + framework
// peers externalized) and fails CI on regressions beyond the budget.
//
// Budget: ~100 kB gzip for @nord-forge/rime-core. CI wires this into
// CI. The renderer-mjml package is excluded from this budget (separate package,
// runs at export time, off the in-browser hot path).
const BUDGET_GZIP = Number(process.env.BUDGET_GZIP ?? 100 * 1024);

// Which package's dist to measure. Defaults to the editor core (the only budgeted
// package).
const PKG = process.env.MEASURE_PKG ?? "packages/rime-core";

const kb = (n: number) => (n / 1024).toFixed(2) + " kB";

function jsBundles(distDir: string): string[] {
  if (!existsSync(distDir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(distDir)) {
    const full = join(distDir, name);
    if (statSync(full).isDirectory()) {
      out.push(...jsBundles(full));
    } else if (name.endsWith(".js") && !name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

const distDir = resolve(process.cwd(), PKG, "dist");
const bundles = jsBundles(distDir);

if (bundles.length === 0) {
  console.error(`❌ No built JS found in ${distDir}. Run the build first.`);
  process.exit(1);
}

let rawTotal = 0;
let gzipTotal = 0;
let brotliTotal = 0;

console.log(`Bundle-size gate for ${PKG} (peers externalized)\n`);
for (const file of bundles) {
  const buf = readFileSync(file);
  const gzip = gzipSync(buf).length;
  const brotli = brotliCompressSync(buf).length;
  rawTotal += buf.length;
  gzipTotal += gzip;
  brotliTotal += brotli;
  const rel = file.slice(distDir.length + 1);
  console.log(`  ${rel.padEnd(28)} raw ${kb(buf.length).padEnd(10)} gzip ${kb(gzip)}`);
}

console.log(
  `\ntotal      raw ${kb(rawTotal).padEnd(10)} gzip ${kb(gzipTotal).padEnd(10)} brotli ${kb(brotliTotal)}`,
);
console.log(`budget     ${kb(BUDGET_GZIP)} gzip`);

let failed = gzipTotal > BUDGET_GZIP;
if (gzipTotal > BUDGET_GZIP) {
  console.error(`\n❌ FAIL: ${kb(gzipTotal)} exceeds budget ${kb(BUDGET_GZIP)}`);
}

// ── Per-entry EAGER-LOAD budgets ───────────────────────────────────────────
// The total above sums every chunk, so it is blind to what loads EAGERLY: a
// dynamic-import split (e.g. Lexical) is meant to keep heavy code OUT of the
// initial closure of an entry. We compute the transitive STATIC-import closure
// of each entry chunk and assert (a) it is within budget and (b) no chunk
// containing Lexical leaks into it. This is the gate ENV-66 added after the pure
// barrel was found dragging Lexical eagerly behind a green total.

/** Static (non-dynamic) relative chunk imports of a built file. */
function staticImports(file: string): string[] {
  const src = readFileSync(file, "utf8");
  const out: string[] = [];
  // `from "./chunk.js"` (static). Dynamic `import("./x.js")` is intentionally
  // NOT matched — that is the lazy boundary we want to stay off the closure.
  const re = /(?:^|[^(])\bfrom\s*"(\.\/[^"]+\.js)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]!.slice(2));
  return out;
}

/** Transitive static-import closure of an entry, by chunk basename. */
function eagerClosure(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const name = queue.shift()!;
    if (seen.has(name)) continue;
    seen.add(name);
    const full = join(distDir, name);
    if (existsSync(full)) queue.push(...staticImports(full));
  }
  return seen;
}

/** A chunk "contains Lexical" if its source references the engine's runtime. */
function chunkHasLexical(name: string): boolean {
  const full = join(distDir, name);
  if (!existsSync(full)) return false;
  const src = readFileSync(full, "utf8");
  return /RangeSelection|registerRichText|\$getRoot|createEditor\(/.test(src);
}

// Entry → eager-load budget (gzip). Only meaningful for the editor core.
const EAGER_BUDGETS: Record<string, number> = {
  "index.js": 40 * 1024, // pure SDK barrel — must be Lexical-free
  "register.js": 45 * 1024, // editor shell — Lexical loads lazily on focus
};

if (PKG.endsWith("rime-core")) {
  console.log(`\nEager-load closures (static imports only; Lexical must stay lazy):`);
  for (const [entry, budget] of Object.entries(EAGER_BUDGETS)) {
    if (!existsSync(join(distDir, entry))) continue;
    const closure = eagerClosure(entry);
    let eager = 0;
    const lexicalLeaks: string[] = [];
    for (const name of closure) {
      const full = join(distDir, name);
      if (!existsSync(full)) continue;
      eager += gzipSync(readFileSync(full)).length;
      if (chunkHasLexical(name)) lexicalLeaks.push(name);
    }
    const within = eager <= budget && lexicalLeaks.length === 0;
    console.log(
      `  ${entry.padEnd(14)} eager ${kb(eager).padEnd(10)} budget ${kb(budget).padEnd(10)} ` +
        `${within ? "✅" : "❌"} (${closure.size} chunks)`,
    );
    if (lexicalLeaks.length > 0) {
      console.error(`     ❌ Lexical leaked into ${entry} via: ${lexicalLeaks.join(", ")}`);
      failed = true;
    }
    if (eager > budget) {
      console.error(`     ❌ ${entry} eager ${kb(eager)} exceeds ${kb(budget)}`);
      failed = true;
    }
  }
}

if (failed) process.exit(1);
console.log(`\n✅ PASS: ${kb(gzipTotal)} within budget; eager closures clean`);
