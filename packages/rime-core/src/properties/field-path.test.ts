import { describe, expect, test } from "bun:test";
import { createIdFactory } from "@nord-forge/rime-model";
import type { BaseNode, ColumnNode } from "@nord-forge/rime-model";
import { getByPath, nestedPartial } from "./field-path";
import { columnsForCount } from "./columns-op";

describe("getByPath", () => {
  const node = {
    id: "n1",
    type: "x",
    text: "hi",
    color: "#ff0000",
    style: { paddingTop: 12, align: "center" },
    button: { label: "Go", href: "https://x.test" },
  } as unknown as BaseNode;

  test("reads a top-level key", () => {
    expect(getByPath(node, "text")).toBe("hi");
  });

  test("reads a nested dot-path", () => {
    expect(getByPath(node, "style.paddingTop")).toBe(12);
    expect(getByPath(node, "button.href")).toBe("https://x.test");
  });

  test("returns undefined for a missing segment (never throws)", () => {
    expect(getByPath(node, "style.missing")).toBeUndefined();
    expect(getByPath(node, "nope.deeper")).toBeUndefined();
  });
});

describe("nestedPartial", () => {
  test("wraps a top-level key", () => {
    expect(nestedPartial("text", "hi")).toEqual({ text: "hi" });
  });

  test("nests a 2-level dot-path", () => {
    expect(nestedPartial("style.paddingTop", 12)).toEqual({ style: { paddingTop: 12 } });
    expect(nestedPartial("button.label", "Go")).toEqual({ button: { label: "Go" } });
  });
});

describe("columnsForCount", () => {
  const newId = createIdFactory();
  const existing: ColumnNode[] = [
    { id: "c1", type: "column", widthPercent: 100, style: {}, children: [] },
  ];

  test("grows to N columns, widths summing to 100, fresh ids for new ones", () => {
    const cols = columnsForCount(existing, 3, newId);
    expect(cols).toHaveLength(3);
    expect(cols.map((c) => c.widthPercent).reduce((a, b) => a + b, 0)).toBe(100);
    expect(cols[0]!.id).toBe("c1"); // reused
    expect(cols[1]!.id).not.toBe("c1"); // fresh
  });

  test("reuses existing column content in order when growing", () => {
    const withChild: ColumnNode[] = [
      {
        id: "c1",
        type: "column",
        widthPercent: 100,
        style: {},
        children: [{ id: "t1", type: "text" } as never],
      },
    ];
    const cols = columnsForCount(withChild, 2, newId);
    expect(cols[0]!.children).toHaveLength(1);
    expect(cols[1]!.children).toHaveLength(0);
  });

  test("shrinks to N columns, dropping extras, widths still sum to 100", () => {
    const three: ColumnNode[] = [
      { id: "a", type: "column", widthPercent: 33, style: {}, children: [] },
      { id: "b", type: "column", widthPercent: 34, style: {}, children: [] },
      { id: "c", type: "column", widthPercent: 33, style: {}, children: [] },
    ];
    const cols = columnsForCount(three, 2, newId);
    expect(cols).toHaveLength(2);
    expect(cols.map((c) => c.widthPercent).reduce((a, b) => a + b, 0)).toBe(100);
  });

  test("clamps to at least one column", () => {
    expect(columnsForCount(existing, 0, newId)).toHaveLength(1);
  });
});
