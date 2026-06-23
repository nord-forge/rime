import { brotliCompressSync, gzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

// Bundle-size gate (OD-4). Reports @enveloppe/core's shipped size (Lit + framework
// peers externalized) and fails CI on regressions beyond the budget.
//
// Budget: ~100 kB gzip for @enveloppe/core (set in ENV-57). ENV-03 wires this into
// CI. The renderer-mjml package is excluded from this budget (separate package,
// runs at export time, off the in-browser hot path).
const BUDGET_GZIP = Number(process.env.BUDGET_GZIP ?? 100 * 1024);

// Which package's dist to measure. Defaults to core (the only budgeted package).
const PKG = process.env.MEASURE_PKG ?? "packages/core";

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

if (gzipTotal > BUDGET_GZIP) {
  console.error(`\n❌ FAIL: ${kb(gzipTotal)} exceeds budget ${kb(BUDGET_GZIP)}`);
  process.exit(1);
}
console.log(`\n✅ PASS: ${kb(gzipTotal)} within budget`);
