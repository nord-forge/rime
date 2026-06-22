import { gzipSync, brotliCompressSync } from 'node:zlib';
import { readFileSync } from 'node:fs';

function sizes(path: string) {
  const buf = readFileSync(path);
  return {
    raw: buf.length,
    gzip: gzipSync(buf).length,
    brotli: brotliCompressSync(buf).length,
  };
}

const baseline = sizes('dist/baseline/baseline.js');
const tiptap = sizes('dist/tiptap/tiptap.js');
const lexical = sizes('dist/lexical/lexical.js');

const kb = (n: number) => (n / 1024).toFixed(1) + ' kB';

console.log('Target            raw        gzip       brotli');
for (const [name, s] of [
  ['baseline (Lit)', baseline],
  ['+ tiptap', tiptap],
  ['+ lexical', lexical],
] as const) {
  console.log(name.padEnd(16), kb(s.raw).padEnd(10), kb(s.gzip).padEnd(10), kb(s.brotli));
}

console.log('\nMARGINAL engine cost (bundle - baseline):');
console.log(
  'tiptap '.padEnd(10),
  'gzip', kb(tiptap.gzip - baseline.gzip).padEnd(10),
  'brotli', kb(tiptap.brotli - baseline.brotli),
);
console.log(
  'lexical'.padEnd(10),
  'gzip', kb(lexical.gzip - baseline.gzip).padEnd(10),
  'brotli', kb(lexical.brotli - baseline.brotli),
);
