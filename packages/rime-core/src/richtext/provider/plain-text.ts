// Lossy plain-text <-> RichTextJSON mapping for the no-Lexical fallback. Flattening
// drops marks/links/headings/lists to plain paragraph text; the inverse turns each
// line into a paragraph. Pure + DOM-free so it's unit-testable and pulls no engine.

import type { RichTextBlock, RichTextJSON } from "@nord-forge/rime-model";

/** Concatenate a block's text runs (or list items' runs) into a single string. */
function blockText(block: RichTextBlock): string {
  if (block.type === "list") {
    return block.items.map((item) => (item.content ?? []).map((r) => r.text).join("")).join("\n");
  }
  return (block.content ?? []).map((r) => r.text).join("");
}

/** RichTextJSON → plain text: each top-level block becomes a line. */
export function richTextToPlain(json: RichTextJSON): string {
  return json.content.map(blockText).join("\n");
}

/** Plain text → RichTextJSON: each line becomes a paragraph. Empty input yields a
 *  single empty paragraph (the canonical empty doc). */
export function plainToRichText(text: string): RichTextJSON {
  const lines = text.split("\n");
  const content: RichTextBlock[] = lines.map((line) =>
    line === ""
      ? { type: "paragraph", content: [] }
      : { type: "paragraph", content: [{ type: "text", text: line }] },
  );
  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph", content: [] }],
  };
}
