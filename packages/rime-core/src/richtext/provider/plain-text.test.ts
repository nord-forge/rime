import { describe, expect, test } from "bun:test";
import type { RichTextJSON } from "@nord-forge/rime-model";
import { plainToRichText, richTextToPlain } from "./plain-text";

describe("richTextToPlain", () => {
  test("concatenates a paragraph's runs", () => {
    const json: RichTextJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
          ],
        },
      ],
    };
    expect(richTextToPlain(json)).toBe("Hello world");
  });

  test("joins multiple blocks with newlines and flattens marks/links", () => {
    const json: RichTextJSON = {
      type: "doc",
      content: [
        { type: "heading", level: 2, content: [{ type: "text", text: "Title" }] },
        {
          type: "paragraph",
          content: [{ type: "text", text: "bold", marks: ["bold"], link: "https://x" }],
        },
        {
          type: "list",
          ordered: false,
          items: [{ type: "listitem", content: [{ type: "text", text: "a" }] }],
        },
      ],
    };
    expect(richTextToPlain(json)).toBe("Title\nbold\na");
  });
});

describe("plainToRichText", () => {
  test("each line becomes a paragraph", () => {
    const json = plainToRichText("one\ntwo");
    expect(json.content).toHaveLength(2);
    expect(json.content[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "one" }],
    });
    expect(json.content[1]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "two" }],
    });
  });

  test("an empty line becomes an empty paragraph", () => {
    const json = plainToRichText("a\n\nb");
    expect(json.content[1]).toEqual({ type: "paragraph", content: [] });
  });

  test("empty input yields a single empty paragraph", () => {
    expect(plainToRichText("")).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [] }],
    });
  });
});

describe("plain-text round-trip", () => {
  test("plain text survives richText -> plain -> richText", () => {
    const text = "line one\nline two";
    expect(richTextToPlain(plainToRichText(text))).toBe(text);
  });
});
