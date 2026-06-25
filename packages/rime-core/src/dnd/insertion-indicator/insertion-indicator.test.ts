import { describe, expect, test } from "bun:test";
import { indicatorLineFor, sectionIndicatorLineFor } from "./insertion-indicator";
import type { ColumnGeometry, DocumentGeometry } from "../resolve-drop-target/resolve-drop-target";

const rect = (top: number, bottom: number, left = 0, right = 100) => ({ top, bottom, left, right });

const COLUMN: ColumnGeometry = {
  columnId: "col_1",
  rect: rect(0, 300, 10, 110),
  children: [
    { id: "a", rect: rect(0, 100, 10, 110) },
    { id: "b", rect: rect(100, 200, 10, 110) },
  ],
};

describe("indicatorLineFor", () => {
  test("insert before child[index] → line at that child's top", () => {
    expect(indicatorLineFor({ parentId: "col_1", index: 1 }, [COLUMN])).toEqual({
      x: 10,
      y: 100,
      width: 100,
    });
  });

  test("insert at start → line at column top", () => {
    expect(indicatorLineFor({ parentId: "col_1", index: 0 }, [COLUMN])).toEqual({
      x: 10,
      y: 0,
      width: 100,
    });
  });

  test("append (index === length) → line below the last child", () => {
    expect(indicatorLineFor({ parentId: "col_1", index: 2 }, [COLUMN])).toEqual({
      x: 10,
      y: 200,
      width: 100,
    });
  });

  test("empty column → line at column top", () => {
    const empty: ColumnGeometry = { columnId: "e", rect: rect(5, 305, 0, 80), children: [] };
    expect(indicatorLineFor({ parentId: "e", index: 0 }, [empty])).toEqual({
      x: 0,
      y: 5,
      width: 80,
    });
  });

  test("unknown column → null", () => {
    expect(indicatorLineFor({ parentId: "nope", index: 0 }, [COLUMN])).toBeNull();
  });
});

const DOC: DocumentGeometry = {
  documentId: "doc_1",
  rect: rect(0, 300, 20, 620),
  sections: [
    { nodeId: "s1", rect: rect(0, 150, 20, 620) },
    { nodeId: "s2", rect: rect(150, 300, 20, 620) },
  ],
};

describe("sectionIndicatorLineFor", () => {
  test("insert before section[index] → full-width line at that section's top", () => {
    expect(sectionIndicatorLineFor({ parentId: "doc_1", index: 1 }, DOC)).toEqual({
      x: 20,
      y: 150,
      width: 600,
    });
  });

  test("insert at start → line at the first section's top", () => {
    expect(sectionIndicatorLineFor({ parentId: "doc_1", index: 0 }, DOC)).toEqual({
      x: 20,
      y: 0,
      width: 600,
    });
  });

  test("append → line below the last section", () => {
    expect(sectionIndicatorLineFor({ parentId: "doc_1", index: 2 }, DOC)).toEqual({
      x: 20,
      y: 300,
      width: 600,
    });
  });

  test("empty document → line at the body top", () => {
    const empty: DocumentGeometry = { documentId: "d", rect: rect(8, 308, 0, 400), sections: [] };
    expect(sectionIndicatorLineFor({ parentId: "d", index: 0 }, empty)).toEqual({
      x: 0,
      y: 8,
      width: 400,
    });
  });

  test("target whose parent isn't the document → null", () => {
    expect(sectionIndicatorLineFor({ parentId: "other", index: 0 }, DOC)).toBeNull();
  });
});
