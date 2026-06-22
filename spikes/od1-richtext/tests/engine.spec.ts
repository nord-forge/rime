import { test, expect } from '@playwright/test';

// Drives each engine in Chromium + WebKit (Safari engine), inside the real
// Lit + iframe canvas. Verifies: (1) it mounts and seeds, (2) JSON round-trip
// preserves text + marks, (3) paste from "Word-like" HTML is sanitized to the
// schema. Each test reports the engine's actual JSON output for inspection.

type Spike = {
  engine: string;
  exec: (c: 'bold' | 'italic') => void;
  toJSON: () => unknown;
  roundTrip: (doc: unknown) => unknown;
  pasteHTML: (html: string) => void;
};

const ENGINES = [
  { tag: 'tiptap', path: '/tiptap/index.html' },
  { tag: 'lexical', path: '/lexical/index.html' },
];

const RICH_DOC = {
  type: 'doc',
  content: [
    {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'Hello ', marks: [] },
        { type: 'text', text: 'bold', marks: ['bold'] },
        { type: 'text', text: ' world', marks: ['italic'] },
      ],
    },
  ],
};

// Garbage a real Word/Outlook paste produces: mso styles, font tags, spans.
const WORD_HTML =
  '<p style="mso-margin-top-alt:auto"><span style="font-family:Calibri;color:red">' +
  '<o:p>Pasted</o:p> <b>bold</b> <font size="4">junk</font></span></p>' +
  '<script>alert(1)</script>';

for (const eng of ENGINES) {
  test.describe(eng.tag, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(eng.path);
      await page.waitForFunction(() => (window as unknown as { __spike?: unknown }).__spike);
    });

    test('mounts and seeds content', async ({ page }) => {
      const json = await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.toJSON());
      expect(JSON.stringify(json)).toContain('Edit me');
    });

    test('JSON round-trip preserves text + marks', async ({ page }) => {
      const out = await page.evaluate(
        (doc) => (window as unknown as { __spike: Spike }).__spike.roundTrip(doc),
        RICH_DOC,
      );
      const s = JSON.stringify(out);
      expect(s).toContain('Hello');
      expect(s).toContain('bold');
      expect(s).toContain('world');
      // marks must survive the round trip
      expect(s).toContain('"bold"');
      expect(s).toContain('"italic"');
      console.log(`[${eng.tag}] round-trip JSON:`, s);
    });

    test('paste from Word-like HTML is sanitized', async ({ page }) => {
      await page.evaluate(
        (html) => (window as unknown as { __spike: Spike }).__spike.pasteHTML(html),
        WORD_HTML,
      );
      await page.waitForTimeout(200);
      const out = await page.evaluate(() => (window as unknown as { __spike: Spike }).__spike.toJSON());
      const s = JSON.stringify(out);
      // No mso/font/script junk should ever reach the doc model.
      expect(s).not.toContain('mso');
      expect(s).not.toContain('o:p');
      expect(s).not.toContain('<script');
      expect(s).not.toContain('font-family');
      console.log(`[${eng.tag}] post-paste JSON:`, s);
    });
  });
}
