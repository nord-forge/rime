// Render every golden fixture to test/golden/<name>.html — the files a human
// sends through real email clients for the verification matrix. Reuses the
// same fixture docs the snapshot test uses (single source of truth).
//
// Run: bun run render:fixtures

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MjmlRenderer } from "../src/index";
import { fixtures } from "../test/fixtures/index";
import { normalizeHtml } from "../test/normalize";

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = resolve(here, "..", "test", "golden");
mkdirSync(goldenDir, { recursive: true });

const renderer = new MjmlRenderer();

const rendered = await Promise.all(
  Object.entries(fixtures).map(async ([name, doc]) => ({
    name,
    html: normalizeHtml(await renderer.render(doc)),
  })),
);

for (const { name, html } of rendered) {
  const path = resolve(goldenDir, `${name}.html`);
  writeFileSync(path, html, "utf8");
  console.log(`wrote ${path} (${html.length} bytes)`);
}

console.log(`\n${rendered.length} fixtures rendered to test/golden/`);
