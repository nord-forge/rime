import { describe, expect, test } from "bun:test";
import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  deserialize,
  type DocumentNode,
  type RichTextJSON,
  SCHEMA_VERSION,
  serialize,
} from "./index";

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

const RICH: RichTextJSON = {
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "text", text: "world", marks: ["bold", "italic"] },
        { type: "text", text: "link", link: "https://x.test", marks: ["underline"] },
      ],
    },
  ],
};

/** Nested doc carrying rich text with marks + a link. */
function buildRichDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 2);
  section.children[0]!.children.push(createTextBlock(newId, RICH));
  section.children[1]!.children.push(createButtonBlock(newId, "CTA", "https://y.test"));
  doc.children.push(section);
  return doc;
}

describe("serialize", () => {
  test("produces a { version, doc } envelope", () => {
    const doc = createEmptyDoc(ids());
    const parsed = JSON.parse(serialize(doc));
    expect(parsed.version).toBe(SCHEMA_VERSION);
    expect(parsed.doc).toEqual(doc);
  });

  test("compact by default, pretty on request, same round-trip", () => {
    const doc = buildRichDoc();
    const compact = serialize(doc);
    const pretty = serialize(doc, { pretty: true });
    expect(pretty.length).toBeGreaterThan(compact.length);
    expect(deserialize(compact)).toEqual(deserialize(pretty));
  });
});

describe("round-trip law", () => {
  test("factory doc survives losslessly", () => {
    const newId = ids();
    const doc = createEmptyDoc(newId);
    doc.children.push(createSection(newId, 3));
    const result = deserialize(serialize(doc));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.doc).toEqual(doc);
  });

  test("rich text with marks + link survives byte-for-byte", () => {
    const doc = buildRichDoc();
    const result = deserialize(serialize(doc));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doc).toEqual(doc);
      const content = (
        result.doc.children[0]!.children[0]!.children[0] as { content: RichTextJSON }
      ).content;
      expect(content).toEqual(RICH);
    }
  });
});

describe("deserialize rejections (never throws)", () => {
  test("malformed JSON", () => {
    const r = deserialize("{not json");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.message).toContain("invalid JSON");
  });

  test("envelope not an object", () => {
    expect(deserialize("42").ok).toBe(false);
  });

  test("missing/wrong-typed version", () => {
    const r = deserialize(JSON.stringify({ doc: createEmptyDoc(ids()) }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.path).toBe("version");
  });

  test("version from the future is rejected", () => {
    const r = deserialize(
      JSON.stringify({ version: SCHEMA_VERSION + 1, doc: createEmptyDoc(ids()) }),
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.message).toContain("unsupported version");
  });

  test("missing/wrong-typed doc", () => {
    const r = deserialize(JSON.stringify({ version: SCHEMA_VERSION, doc: "nope" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.path).toBe("doc");
  });

  test("re-validates: a tampered doc (duplicate ids) is rejected on load", () => {
    const newId = ids();
    const doc = createEmptyDoc(newId);
    const section = createSection(newId, 1);
    section.children[0]!.children.push(createTextBlock(newId));
    doc.children.push(section);
    // tamper: duplicate the doc id onto a deep node
    section.children[0]!.children[0]!.id = doc.id;
    const r = deserialize(serialize(doc));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.message.includes("duplicate id"))).toBe(true);
  });
});
