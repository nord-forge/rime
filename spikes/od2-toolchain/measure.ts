import { gzipSync, brotliCompressSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';

// Bundle-size gate (OD-4). Reports our component's shipped size (Lit external)
// and enforces a budget so CI fails on regressions. The budget here is for the
// SPIKE component only; the real @enveloppe/core budget is set in ENV-57.
const BUDGET_GZIP = Number(process.env.BUDGET_GZIP ?? 8 * 1024); // 8 kB default

const kb = (n: number) => (n / 1024).toFixed(2) + ' kB';

function report(label: string, path: string) {
  if (!existsSync(path)) {
    console.log(`${label.padEnd(10)} (not built)`);
    return null;
  }
  const buf = readFileSync(path);
  const gzip = gzipSync(buf).length;
  const brotli = brotliCompressSync(buf).length;
  console.log(
    `${label.padEnd(10)} raw ${kb(buf.length).padEnd(10)} gzip ${kb(gzip).padEnd(10)} brotli ${kb(brotli)}`,
  );
  return gzip;
}

console.log('OD-2 bundle gate (component code only, Lit externalized)\n');
const vite = report('vite', 'dist/vite/enveloppe-core.js');
const rolldown = report('rolldown', 'dist/rolldown/enveloppe-core.js');

if (vite != null && rolldown != null) {
  const diff = rolldown - vite;
  const sign = diff >= 0 ? '+' : '';
  console.log(`\nrolldown vs vite (gzip): ${sign}${kb(diff)} (${((diff / vite) * 100).toFixed(1)}%)`);
}

const measured = vite ?? rolldown;
if (measured != null) {
  console.log(`\nbudget: ${kb(BUDGET_GZIP)} gzip`);
  if (measured > BUDGET_GZIP) {
    console.error(`❌ FAIL: ${kb(measured)} exceeds budget ${kb(BUDGET_GZIP)}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${kb(measured)} within budget`);
}
