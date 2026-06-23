import { describe, expect, test } from "bun:test";
import {
  applyPatch,
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
  insertNode,
  invertPatch,
  moveNode,
  type OpResult,
  removeNode,
  setRichText,
  updateNode,
  validateDoc,
} from "./index";

// Deterministic ids for stable structural assertions.
function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

/** Doc: one section with two 50% columns; col0 has a text block, col1 a button. */
function buildDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 2);
  section.children[0]!.children.push(createTextBlock(newId));
  section.children[1]!.children.push(createButtonBlock(newId));
  doc.children.push(section);
  return doc;
}

/** The inverse law: applying inverse to the new doc restores the original. */
function expectInverseRestores(original: DocumentNode, result: OpResult) {
  const restored = applyPatch(result.doc, result.inverse);
  expect(restored).toEqual(original);
}

describe("immutability", () => {
  test("operations never mutate the input doc", () => {
    const doc = buildDoc();
    const snapshot = structuredClone(doc);
    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    updateNode(doc, textId, { style: { paddingTop: 8 } });
    removeNode(doc, textId);
    expect(doc).toEqual(snapshot);
  });
});

describe("structural sharing", () => {
  test("unchanged sibling keeps its original reference", () => {
    const doc = buildDoc();
    const col1 = doc.children[0]!.children[1]!; // untouched sibling
    const textId = doc.children[0]!.children[0]!.id;
    const { doc: next } = updateNode(doc, textId, { style: { paddingTop: 8 } });
    // col1 lives in the same section; it must be the SAME object, not a clone.
    expect(next.children[0]!.children[1]).toBe(col1);
  });
});

describe("updateNode", () => {
  test("shallow-merges style and returns inverse", () => {
    const doc = buildDoc();
    const textId = doc.children[0]!.children[0]!.id;
    const result = updateNode(doc, textId, { style: { paddingTop: 8 } });
    expect((result.doc.children[0]!.children[0] as { style: object }).style).toEqual({
      paddingTop: 8,
    });
    expect(validateDoc(result.doc).ok).toBe(true);
    expectInverseRestores(doc, result);
  });

  test("throws on unknown id", () => {
    expect(() => updateNode(buildDoc(), "nope", { style: {} })).toThrow();
  });
});

describe("insertNode", () => {
  test("inserts a leaf and inverse removes it", () => {
    const doc = buildDoc();
    const newId = ids();
    const col0 = doc.children[0]!.children[0]!;
    const block = createButtonBlock(() => "btn_new");
    const result = insertNode(doc, col0.id, 1, block);
    expect(result.doc.children[0]!.children[0]!.children).toHaveLength(2);
    expect(validateDoc(result.doc).ok).toBe(true);
    expectInverseRestores(doc, result);
    void newId;
  });
});

describe("removeNode", () => {
  test("removes a leaf and inverse reinserts it", () => {
    const doc = buildDoc();
    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    const result = removeNode(doc, textId);
    expect(result.doc.children[0]!.children[0]!.children).toHaveLength(0);
    expectInverseRestores(doc, result);
  });

  test("cannot remove the document root", () => {
    const doc = buildDoc();
    expect(() => removeNode(doc, doc.id)).toThrow();
  });
});

describe("moveNode", () => {
  test("moves a leaf between columns; inverse restores", () => {
    const doc = buildDoc();
    const text = doc.children[0]!.children[0]!.children[0]!;
    const col1 = doc.children[0]!.children[1]!;
    const result = moveNode(doc, text.id, col1.id, 0);
    expect(result.doc.children[0]!.children[0]!.children).toHaveLength(0);
    expect(result.doc.children[0]!.children[1]!.children[0]!.id).toBe(text.id);
    expect(validateDoc(result.doc).ok).toBe(true);
    expectInverseRestores(doc, result);
  });

  test("reorders columns within the same section; inverse restores", () => {
    const doc = buildDoc();
    const section = doc.children[0]!;
    const col0Id = section.children[0]!.id;
    // move col0 to the end (index 2 -> clamped to after removal)
    const result = moveNode(doc, col0Id, section.id, 2);
    expect(result.doc.children[0]!.children[1]!.id).toBe(col0Id);
    expectInverseRestores(doc, result);
  });

  test("reorders multiple leaves within one column; inverse restores", () => {
    const newId = ids();
    const doc = createEmptyDoc(newId);
    const section = createSection(newId, 1);
    const col = section.children[0]!;
    col.children.push(createTextBlock(newId), createButtonBlock(newId), createTextBlock(newId));
    doc.children.push(section);
    const firstId = col.children[0]!.id;
    const result = moveNode(doc, firstId, col.id, 2);
    expect(result.doc.children[0]!.children[0]!.children[1]!.id).toBe(firstId);
    expectInverseRestores(doc, result);
  });
});

describe("setRichText", () => {
  test("replaces content and inverse restores", () => {
    const doc = buildDoc();
    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    const result = setRichText(doc, textId, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    });
    const content = (result.doc.children[0]!.children[0]!.children[0] as { content: unknown })
      .content;
    expect(content).toEqual({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
    });
    expectInverseRestores(doc, result);
  });

  test("throws if the target is not a text block", () => {
    const doc = buildDoc();
    const buttonId = doc.children[0]!.children[1]!.children[0]!.id;
    expect(() => setRichText(doc, buttonId, { type: "doc", content: [] })).toThrow();
  });
});

describe("invertPatch directly", () => {
  test("multi-op patch inverts in reverse order", () => {
    const doc = buildDoc();
    const col0 = doc.children[0]!.children[0]!;
    const r1 = insertNode(
      doc,
      col0.id,
      0,
      createTextBlock(() => "t_x"),
    );
    const r2 = updateNode(r1.doc, "t_x", { style: { paddingTop: 4 } });
    // Compose: apply r1 then r2; invert the combined patch.
    const combined = [...r1.patch, ...r2.patch];
    const inverse = invertPatch(doc, combined);
    const final = applyPatch(applyPatch(doc, combined), inverse);
    expect(final).toEqual(doc);
  });
});
