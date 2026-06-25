// Guard: the editor must never STATICALLY import Lexical (directly or via the
// Lexical provider / its richtext deps). Lexical is pulled in ONLY through the
// `await import("../richtext/provider/lexical-provider")` split point, so a build
// with `lexicalEditor: false` never loads it. This test locks that contract in —
// if someone adds a top-level `import ... from ".../lexical-provider"` (or lexical)
// to the editor, it fails here rather than silently bloating every bundle.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const editorSrc = readFileSync(
  fileURLToPath(new URL("../../rime-editor/rime-editor.ts", import.meta.url)),
  "utf8",
);

// Static import lines only (ignore the dynamic `await import(...)`).
const staticImportLines = editorSrc
  .split("\n")
  .filter((line) => /^\s*import\s/.test(line) && !line.includes("await"));

describe("editor does not statically import Lexical", () => {
  test("no static import of the lexical provider or lexical-coupled modules", () => {
    const offenders = staticImportLines.filter((line) =>
      /lexical-provider|lexical-editor|richtext-lifecycle|rich-text-toolbar|rich-text-commands|"lexical"|@lexical\//.test(
        line,
      ),
    );
    expect(offenders).toEqual([]);
  });

  test("the Lexical provider is loaded via a dynamic import()", () => {
    expect(editorSrc).toContain('await import("../richtext/provider/lexical-provider")');
  });
});
