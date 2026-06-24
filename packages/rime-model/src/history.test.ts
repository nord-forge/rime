import { describe, expect, test } from "bun:test";
import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
  History,
  insertNode,
  setRichText,
  updateNode,
} from "./index";

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

/** Doc: one section, two 50% columns; col0 has a text block. */
function buildDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 2);
  section.children[0]!.children.push(createTextBlock(newId));
  section.children[1]!.children.push(createButtonBlock(newId));
  doc.children.push(section);
  return doc;
}

/** A manual clock so coalescing tests are deterministic. */
function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("basic undo/redo", () => {
  test("canUndo/canRedo reflect stack state", () => {
    const doc = buildDoc();
    const h = new History(doc);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);

    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    h.record(updateNode(doc, textId, { style: { paddingTop: 8 } }));
    expect(h.canUndo).toBe(true);
    expect(h.canRedo).toBe(false);

    h.undo();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(true);
  });

  test("undo restores prior state, redo re-applies", () => {
    const doc = buildDoc();
    const h = new History(doc);
    const textId = doc.children[0]!.children[0]!.children[0]!.id;

    const r = updateNode(doc, textId, { style: { paddingTop: 8 } });
    h.record(r);
    expect(h.doc).toEqual(r.doc);

    expect(h.undo()).toEqual(doc); // back to original
    expect(h.redo()).toEqual(r.doc); // forward again
  });

  test("multi-op sequence round-trips both directions", () => {
    const doc = buildDoc();
    const h = new History(doc);
    const col0 = doc.children[0]!.children[0]!;
    const textId = col0.children[0]!.id;

    const r1 = updateNode(doc, textId, { style: { paddingTop: 4 } });
    h.record(r1);
    const r2 = insertNode(
      r1.doc,
      col0.id,
      1,
      createButtonBlock(() => "btn_x"),
    );
    h.record(r2);

    expect(h.doc).toEqual(r2.doc);
    expect(h.undo()).toEqual(r1.doc);
    expect(h.undo()).toEqual(doc);
    expect(h.canUndo).toBe(false);
    expect(h.redo()).toEqual(r1.doc);
    expect(h.redo()).toEqual(r2.doc);
  });
});

describe("redo invalidation", () => {
  test("a push after undo clears the redo stack", () => {
    const doc = buildDoc();
    const h = new History(doc);
    const textId = doc.children[0]!.children[0]!.children[0]!.id;

    h.record(updateNode(doc, textId, { style: { paddingTop: 4 } }));
    h.undo();
    expect(h.canRedo).toBe(true);

    // new edit from the reverted state
    h.record(updateNode(h.doc, textId, { style: { paddingBottom: 9 } }));
    expect(h.canRedo).toBe(false);
  });
});

describe("depth cap", () => {
  test("never exceeds maxDepth; oldest dropped", () => {
    const doc = buildDoc();
    const h = new History(doc, { maxDepth: 3 });
    const textId = doc.children[0]!.children[0]!.children[0]!.id;

    let current = doc;
    for (let i = 1; i <= 6; i += 1) {
      const r = updateNode(current, textId, { style: { paddingTop: i } });
      h.record(r);
      current = r.doc;
    }
    expect(h.depth).toBe(3);

    // can only undo 3 times, then stops
    h.undo();
    h.undo();
    h.undo();
    expect(h.canUndo).toBe(false);
  });
});

describe("coalescing", () => {
  test("same key within window collapses to one undo entry", () => {
    const doc = buildDoc();
    const clock = fakeClock();
    const h = new History(doc, { coalesceWindowMs: 500, now: clock.now });
    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    const key = `text:${textId}`;

    let current = doc;
    for (const word of ["a", "ab", "abc"]) {
      const r = setRichText(current, textId, {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: word }] }],
      });
      h.record(r, key);
      current = r.doc;
      clock.advance(100); // all within the 500ms window
    }

    expect(h.depth).toBe(1); // three edits, one entry
    expect(h.undo()).toEqual(doc); // single undo reverts the whole burst
  });

  test("edits outside the window are separate entries", () => {
    const doc = buildDoc();
    const clock = fakeClock();
    const h = new History(doc, { coalesceWindowMs: 500, now: clock.now });
    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    const key = `text:${textId}`;

    const r1 = setRichText(doc, textId, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "x" }] }],
    });
    h.record(r1, key);
    clock.advance(600); // beyond the window
    const r2 = setRichText(r1.doc, textId, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "xy" }] }],
    });
    h.record(r2, key);

    expect(h.depth).toBe(2);
  });

  test("different keys never coalesce", () => {
    const doc = buildDoc();
    const clock = fakeClock();
    const h = new History(doc, { now: clock.now });
    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    const buttonId = doc.children[0]!.children[1]!.children[0]!.id;

    h.record(updateNode(doc, textId, { style: { paddingTop: 1 } }), `text:${textId}`);
    h.record(updateNode(h.doc, buttonId, { style: { paddingTop: 1 } }), `button:${buttonId}`);
    expect(h.depth).toBe(2);
  });
});

describe("clear + guards", () => {
  test("clear resets stacks, keeps doc", () => {
    const doc = buildDoc();
    const h = new History(doc);
    const textId = doc.children[0]!.children[0]!.children[0]!.id;
    const r = updateNode(doc, textId, { style: { paddingTop: 8 } });
    h.record(r);
    h.clear();
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
    expect(h.doc).toEqual(r.doc); // current doc unchanged
  });

  test("undo/redo throw when empty", () => {
    const h = new History(buildDoc());
    expect(() => h.undo()).toThrow();
    expect(() => h.redo()).toThrow();
  });
});
