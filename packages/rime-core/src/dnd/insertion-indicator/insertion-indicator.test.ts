import { describe, expect, test } from "bun:test";
import { indicatorLineFor } from "./insertion-indicator";
import type { ColumnGeometry } from "../resolve-drop-target/resolve-drop-target";

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
