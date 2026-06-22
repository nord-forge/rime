import { gzipSync, brotliCompressSync } from 'node:zlib';
import { readFileSync, existsSync } from 'node:fs';

function sizes(path: string) {
  const buf = readFileSync(path);
  return { raw: buf.length, gzip: gzipSync(buf).length, brotli: brotliCompressSync(buf).length };
}
const kb = (n: number) => (n / 1024).toFixed(1) + ' kB';

const targets = [
  ['baseline (Lit)', 'dist/baseline/baseline.js'],
  ['tiptap StarterKit', 'dist/tiptap/tiptap.js'],
  ['tiptap curated', 'dist/tiptap-curated/tiptap-curated.js'],
  ['tiptap minimal', 'dist/tiptap-minimal/tiptap-minimal.js'],
  ['lexical (wired)', 'dist/lexical/lexical.js'],
] as const;

const base = existsSync('dist/baseline/baseline.js') ? sizes('dist/baseline/baseline.js') : null;

console.log('Target               raw        gzip       brotli     marginal(gzip)');
for (const [name, path] of targets) {
  if (!existsSync(path)) continue;
  const s = sizes(path);
  const marg = base && name !== 'baseline (Lit)' ? kb(s.gzip - base.gzip) : '—';
  console.log(name.padEnd(20), kb(s.raw).padEnd(10), kb(s.gzip).padEnd(10), kb(s.brotli).padEnd(10), marg);
}
