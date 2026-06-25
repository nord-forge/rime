import { describe, expect, test } from "bun:test";
import {
  createColumn,
  createEmptyDoc,
  createIdFactory,
  createSection,
  createTextBlock,
} from "./factory";
import type { RichTextJSON } from "./rich-text";
import { validateDoc } from "./validate";

// Build a minimal valid doc whose single text block carries `content`.
function docWithText(content: RichTextJSON) {
  const newId = createIdFactory();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 1);
  const col = section.children[0] as ReturnType<typeof createColumn>;
  col.children.push(createTextBlock(newId, content));
  doc.children.push(section);
  return doc;
}

function errorsFor(content: unknown): string[] {
  const result = validateDoc(docWithText(content as RichTextJSON));
  return result.ok ? [] : result.errors.map((e) => e.message);
}

describe("RichTextJSON schema — blocks", () => {
  test("accepts paragraphs, headings and lists", () => {
    const content: RichTextJSON = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "intro" }] },
        { type: "heading", level: 2, content: [{ type: "text", text: "Title", marks: ["bold"] }] },
        {
          type: "list",
          ordered: false,
          items: [
            { type: "listitem", content: [{ type: "text", text: "one" }] },
            { type: "listitem", content: [{ type: "text", text: "two", link: "https://x.test" }] },
          ],
        },
      ],
    };
    expect(errorsFor(content)).toEqual([]);
  });

  test("rejects an unknown heading level", () => {
    const errors = errorsFor({
      type: "doc",
      content: [{ type: "heading", level: 4, content: [] }],
    });
    expect(errors.some((m) => m.includes("heading level"))).toBe(true);
  });

  test("rejects a list with a non-boolean ordered flag", () => {
    const errors = errorsFor({
      type: "doc",
      content: [{ type: "list", ordered: "yes", items: [] }],
    });
    expect(errors.some((m) => m.includes("ordered must be a boolean"))).toBe(true);
  });

  test("rejects a list item of the wrong type", () => {
    const errors = errorsFor({
      type: "doc",
      content: [{ type: "list", ordered: true, items: [{ type: "paragraph", content: [] }] }],
    });
    expect(errors.some((m) => m.includes("listitem"))).toBe(true);
  });

  test("rejects an unknown block type", () => {
    const errors = errorsFor({ type: "doc", content: [{ type: "quote", content: [] }] });
    expect(errors.some((m) => m.includes("paragraph, heading or list"))).toBe(true);
  });

  test("accepts token inlines mixed with text", () => {
    const content: RichTextJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hi " },
            { type: "token", token: "first_name", label: "First name" },
            { type: "text", text: "!" },
          ],
        },
      ],
    };
    expect(errorsFor(content)).toEqual([]);
  });

  test("rejects a token with an empty key", () => {
    const errors = errorsFor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "token", token: "  " }] }],
    });
    expect(errors.some((m) => m.includes("token must be a non-empty string"))).toBe(true);
  });

  test("rejects a token with a non-string label", () => {
    const errors = errorsFor({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "token", token: "x", label: 1 }] }],
    });
    expect(errors.some((m) => m.includes("label must be a string"))).toBe(true);
  });

  test("still validates marks/links inside heading + list runs", () => {
    const errors = errorsFor({
      type: "doc",
      content: [
        { type: "heading", level: 1, content: [{ type: "text", text: "x", marks: ["huge"] }] },
      ],
    });
    expect(errors.some((m) => m.includes('unknown mark "huge"'))).toBe(true);
  });
});
