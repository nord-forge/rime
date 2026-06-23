// Golden-snapshot gate (PRD §11). Re-render each fixture and compare to its
// committed test/golden/<name>.html. An unintended renderer change fails here.
//
// To intentionally update goldens after a deliberate output change:
//   bun run --filter='@enveloppe/renderer-mjml' render:fixtures
// then review the diff and commit.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type DocumentNode, validateDoc } from "@enveloppe/doc-model";
import { MjmlRenderer } from "../src/index";
import { fixtures } from "./fixtures/index";
import { normalizeHtml } from "./normalize";

const here = dirname(fileURLToPath(import.meta.url));
const goldenDir = resolve(here, "golden");
const renderer = new MjmlRenderer();

const entries = Object.entries(fixtures) as [string, DocumentNode][];

test("at least five fixtures exist", () => {
  expect(entries.length).toBeGreaterThanOrEqual(5);
});

describe("fixtures are valid docs", () => {
  for (const [name, doc] of entries) {
    test(`${name} passes validateDoc`, () => {
      expect(validateDoc(doc).ok).toBe(true);
    });
  }
});

describe("golden snapshots", () => {
  for (const [name, doc] of entries) {
    test(`${name} matches committed golden output`, async () => {
      const goldenPath = resolve(goldenDir, `${name}.html`);
      expect(existsSync(goldenPath)).toBe(true);
      const golden = readFileSync(goldenPath, "utf8");
      const actual = normalizeHtml(await renderer.render(doc));
      expect(actual).toBe(golden);
    });
  }
});

describe("sanity: goldens carry Outlook-safe scaffolding", () => {
  test("button golden has mso conditionals", () => {
    const html = readFileSync(resolve(goldenDir, "button.html"), "utf8");
    expect(html.toLowerCase()).toContain("if mso");
  });
});
