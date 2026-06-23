import { describe, expect, test } from "bun:test";
import { type ColumnGeometry, resolveDropTarget } from "./resolve-drop-target";

const rect = (top: number, bottom: number, left = 0, right = 100) => ({ top, bottom, left, right });

/** One column at x[0..100], y[0..300] with three 100px-tall children. */
function columnWithThree(): ColumnGeometry {
  return {
    columnId: "col_1",
    rect: rect(0, 300),
    children: [
      { id: "a", rect: rect(0, 100) }, // midpoint 50
      { id: "b", rect: rect(100, 200) }, // midpoint 150
      { id: "c", rect: rect(200, 300) }, // midpoint 250
    ],
  };
}

describe("resolveDropTarget", () => {
  test("returns null when the point is over no column", () => {
    expect(resolveDropTarget({ x: 500, y: 500 }, [columnWithThree()])).toBeNull();
  });

  test("empty column → index 0", () => {
    const empty: ColumnGeometry = { columnId: "col_e", rect: rect(0, 300), children: [] };
    expect(resolveDropTarget({ x: 50, y: 150 }, [empty])).toEqual({ parentId: "col_e", index: 0 });
  });

  test("above the first midpoint → index 0", () => {
    expect(resolveDropTarget({ x: 50, y: 10 }, [columnWithThree()])).toEqual({
      parentId: "col_1",
      index: 0,
    });
  });

  test("between first and second midpoint → index 1", () => {
    // y=120 is below a's midpoint (50), above b's (150)
    expect(resolveDropTarget({ x: 50, y: 120 }, [columnWithThree()])).toEqual({
      parentId: "col_1",
      index: 1,
    });
  });

  test("below the last midpoint → append at end", () => {
    expect(resolveDropTarget({ x: 50, y: 290 }, [columnWithThree()])).toEqual({
      parentId: "col_1",
      index: 3,
    });
  });

  test("picks the column the point is inside when several exist", () => {
    const left: ColumnGeometry = { columnId: "L", rect: rect(0, 300, 0, 100), children: [] };
    const right: ColumnGeometry = { columnId: "R", rect: rect(0, 300, 100, 200), children: [] };
    expect(resolveDropTarget({ x: 150, y: 50 }, [left, right])).toEqual({
      parentId: "R",
      index: 0,
    });
  });
});
