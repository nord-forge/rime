import { describe, expect, test } from "bun:test";
import {
  createButtonBlock,
  createEmptyDoc,
  createIdFactory,
  createSection,
  createTextBlock,
  type DocumentNode,
  emptyRichText,
  validateDoc,
} from "./index";

// Deterministic id factory for stable assertions.
const ids = () => {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
};

/** Build a minimal valid doc: one section, two 50% columns, a text + button. */
function buildValidDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 2);
  section.children[0]!.children.push(createTextBlock(newId));
  section.children[1]!.children.push(createButtonBlock(newId, "Go", "https://x.test"));
  doc.children.push(section);
  return doc;
}

describe("factory + validateDoc happy path", () => {
  test("createEmptyDoc produces a valid (empty) document", () => {
    const result = validateDoc(createEmptyDoc(ids()));
    expect(result.ok).toBe(true);
  });

  test("a full hand-built doc validates", () => {
    const result = validateDoc(buildValidDoc());
    expect(result).toEqual({ ok: true, doc: buildValidDoc() } as never);
  });

  test("createSection splits widths evenly summing to 100", () => {
    const section = createSection(ids(), 3);
    const sum = section.children.reduce((a, c) => a + c.widthPercent, 0);
    expect(sum).toBe(100);
    expect(section.children).toHaveLength(3);
  });
});

describe("validateDoc rejections (with precise paths)", () => {
  test("rejects a non-object / wrong root type", () => {
    expect(validateDoc(42).ok).toBe(false);
    const r = validateDoc({ id: "x", type: "section" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.some((e) => e.path === "$.type")).toBe(true);
  });

  test("rejects duplicate ids with a path", () => {
    const doc = buildValidDoc();
    // force a duplicate id deep in the tree
    doc.children[0]!.children[0]!.id = doc.id;
    const r = validateDoc(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const dup = r.errors.find((e) => e.message.includes("duplicate id"));
      expect(dup?.path).toBe("$.children[0].children[0].id");
    }
  });

  test("rejects an unknown leaf type", () => {
    const doc = buildValidDoc();
    (doc.children[0]!.children[0]!.children[0] as { type: string }).type = "video";
    const r = validateDoc(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(
        r.errors.some(
          (e) =>
            e.path === "$.children[0].children[0].children[0].type" &&
            e.message.includes("unknown leaf type"),
        ),
      ).toBe(true);
    }
  });

  test("rejects illegal parent→child nesting (section directly under document missing)", () => {
    const newId = ids();
    const doc = createEmptyDoc(newId);
    // a column placed where a section must be
    doc.children.push({ id: "bad", type: "column" } as never);
    const r = validateDoc(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.path).toBe("$.children[0]");
  });

  test("rejects columns that do not sum to ~100", () => {
    const doc = buildValidDoc();
    doc.children[0]!.children[0]!.widthPercent = 10; // 10 + 50 = 60
    const r = validateDoc(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const sumErr = r.errors.find((e) => e.message.includes("sum to ~100"));
      expect(sumErr?.path).toBe("$.children[0].children");
    }
  });

  test("accepts column widths within ±1 rounding tolerance", () => {
    const newId = ids();
    const doc = createEmptyDoc(newId);
    const section = createSection(newId, 3); // 33,33,34 = 100
    doc.children.push(section);
    section.children[2]!.widthPercent = 33; // now 99 — within tolerance
    expect(validateDoc(doc).ok).toBe(true);
  });

  test("rejects non-finite numbers", () => {
    const doc = buildValidDoc();
    doc.settings.contentWidth = Number.NaN;
    const r = validateDoc(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.some((e) => e.path === "$.settings.contentWidth")).toBe(true);
    }
  });

  test("rejects malformed rich text content", () => {
    const newId = ids();
    const doc = createEmptyDoc(newId);
    const section = createSection(newId, 1);
    const text = createTextBlock(newId);
    (text as { content: unknown }).content = { type: "doc", content: "nope" };
    section.children[0]!.children.push(text);
    doc.children.push(section);
    const r = validateDoc(doc);
    expect(r.ok).toBe(false);
  });
});

describe("section-level band blocks (extraSectionTypes)", () => {
  test("accepts a registered band block beside sections", () => {
    const doc = buildValidDoc();
    doc.children.unshift({ id: "band1", type: "hero", style: { align: "center" } } as never);
    expect(validateDoc(doc, { extraSectionTypes: ["hero"] }).ok).toBe(true);
  });

  test("rejects a band block whose type is not allowed", () => {
    const doc = buildValidDoc();
    doc.children.unshift({ id: "band1", type: "hero" } as never);
    const r = validateDoc(doc);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.path).toBe("$.children[0]");
  });

  test("validates a band's BlockStyle generically", () => {
    const doc = buildValidDoc();
    doc.children.unshift({ id: "band1", type: "hero", style: { align: "sideways" } } as never);
    const r = validateDoc(doc, { extraSectionTypes: ["hero"] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]!.path).toBe("$.children[0].style.align");
  });

  test("a band block still needs a valid id", () => {
    const doc = buildValidDoc();
    doc.children.unshift({ type: "hero" } as never);
    expect(validateDoc(doc, { extraSectionTypes: ["hero"] }).ok).toBe(false);
  });
});

describe("rich text helpers", () => {
  test("emptyRichText is a valid single empty paragraph", () => {
    const rt = emptyRichText();
    expect(rt).toEqual({ type: "doc", content: [{ type: "paragraph", content: [] }] });
  });
});

describe("default id factory", () => {
  test("produces unique ids", () => {
    const newId = createIdFactory();
    const a = newId("x");
    const b = newId("x");
    expect(a).not.toBe(b);
    expect(a.startsWith("x_")).toBe(true);
  });
});
