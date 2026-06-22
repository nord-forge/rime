import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// Build-success ≠ runs. Load each engine's bundle in a real browser, register
// the element, and assert it renders + the CSS-var theming actually applies.
// Lit is externalized in the lib build, so we import it from a CDN at runtime.
for (const engine of ['vite', 'rolldown']) {
  test(`${engine} bundle renders themed-panel with applied CSS vars`, async ({ page }) => {
    const code = readFileSync(`dist/${engine}/enveloppe-core.js`, 'utf8').replace(
      /from\s*["']lit["']/g,
      'from "https://esm.sh/lit@3.3.3"',
    ).replace(/from\s*["']lit\/(.*?)["']/g, 'from "https://esm.sh/lit@3.3.3/$1"');

    await page.setContent(
      `<style>themed-panel{--eb-color-accent:rgb(10,20,30)}</style>
       <themed-panel heading="Hello OD-2"></themed-panel>
       <script type="module">${code}</script>`,
    );

    const panel = page.locator('themed-panel');
    await expect(panel).toBeVisible();
    // shadow DOM rendered the heading
    await expect(panel.locator('.accent')).toHaveText('Hello OD-2');
    // CSS custom property pierced shadow DOM and applied
    await expect(panel.locator('.accent')).toHaveCSS('color', 'rgb(10, 20, 30)');
    // iframe canvas mounted
    await expect(panel.locator('iframe')).toHaveCount(1);
  });
}
