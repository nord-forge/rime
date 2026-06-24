import { describe, expect, test } from "bun:test";
import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
  moveNode,
  type OpResult,
} from "@nord-forge/rime-model";
import { KeyboardMoveController, locateLeaf, resolveMove } from "./keyboard-move";

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

/** section with two columns: col_1 [a,b], col_2 [c]. */
function buildDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 2);
  section.children[0]!.children.push(createTextBlock(newId), createTextBlock(newId));
  section.children[1]!.children.push(createButtonBlock(newId));
  doc.children.push(section);
  return doc;
}

describe("locateLeaf", () => {
  test("finds a leaf's position", () => {
    const doc = buildDoc();
    const b = doc.children[0]!.children[0]!.children[1]!.id;
    const loc = locateLeaf(doc, b);
    expect(loc).toMatchObject({ columnIndex: 0, leafIndex: 1, leafCount: 2, columnCount: 2 });
  });
  test("null for unknown id", () => {
    expect(locateLeaf(buildDoc(), "nope")).toBeNull();
  });
});

describe("resolveMove", () => {
  test("up within column", () => {
    const doc = buildDoc();
    const col1 = doc.children[0]!.children[0]!;
    const b = col1.children[1]!.id;
    expect(resolveMove(doc, b, "up")).toEqual({ parentId: col1.id, index: 0 });
  });

  test("up at top carries into previous column's end (or null if none)", () => {
    const doc = buildDoc();
    const col1 = doc.children[0]!.children[0]!;
    const col2 = doc.children[0]!.children[1]!;
    const a = col1.children[0]!.id; // top of col_1 → no prev column
    expect(resolveMove(doc, a, "up")).toBeNull();
    const c = col2.children[0]!.id; // top of col_2 → into col_1 end
    expect(resolveMove(doc, c, "up")).toEqual({ parentId: col1.id, index: 2 });
  });

  test("down at bottom carries into next column's start (or null if none)", () => {
    const doc = buildDoc();
    const col1 = doc.children[0]!.children[0]!;
    const col2 = doc.children[0]!.children[1]!;
    const b = col1.children[1]!.id; // bottom of col_1 → into col_2 start
    expect(resolveMove(doc, b, "down")).toEqual({ parentId: col2.id, index: 0 });
    const c = col2.children[0]!.id; // bottom of col_2 → no next column
    expect(resolveMove(doc, c, "down")).toBeNull();
  });

  test("into-next / into-prev column to that column's end", () => {
    const doc = buildDoc();
    const col1 = doc.children[0]!.children[0]!;
    const col2 = doc.children[0]!.children[1]!;
    const a = col1.children[0]!.id;
    expect(resolveMove(doc, a, "into-next-column")).toEqual({ parentId: col2.id, index: 1 });
    expect(resolveMove(doc, a, "into-prev-column")).toBeNull(); // col_1 has no prev
  });
});

describe("KeyboardMoveController.move", () => {
  function harness() {
    let doc = buildDoc();
    const calls: { selected: string | null; focused: string | null; announced: string[] } = {
      selected: null,
      focused: null,
      announced: [],
    };
    const ctrl = new KeyboardMoveController({
      getDoc: () => doc,
      dispatch: (op: OpResult) => {
        doc = op.doc as DocumentNode;
      },
      getSelected: () => calls.selected,
      setSelected: (id) => {
        calls.selected = id;
      },
      focusNode: (id) => {
        calls.focused = id;
      },
      announce: (m) => calls.announced.push(m),
      moveNode,
    });
    return { ctrl, calls, getDoc: () => doc };
  }

  test("applies moveNode, updates selection + focus + announce", () => {
    const { ctrl, calls, getDoc } = harness();
    const b = getDoc().children[0]!.children[0]!.children[1]!.id;
    expect(ctrl.move(b, "up")).toBe(true);
    // b is now first in col_1
    expect(getDoc().children[0]!.children[0]!.children[0]!.id).toBe(b);
    expect(calls.selected).toBe(b);
    expect(calls.focused).toBe(b);
    expect(calls.announced).toHaveLength(1);
  });

  test("down within column actually swaps order (moveNode adjustment handled)", () => {
    const { ctrl, getDoc } = harness();
    const col1 = getDoc().children[0]!.children[0]!;
    const a = col1.children[0]!.id;
    const b = col1.children[1]!.id;
    expect(ctrl.move(a, "down")).toBe(true);
    expect(getDoc().children[0]!.children[0]!.children.map((c) => c.id)).toEqual([b, a]);
  });

  test("returns false on an impossible move (no-op)", () => {
    const { ctrl, getDoc } = harness();
    const a = getDoc().children[0]!.children[0]!.children[0]!.id;
    expect(ctrl.move(a, "up")).toBe(false); // already at top, no prev column
  });
});
