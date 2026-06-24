import { describe, expect, test } from "bun:test";
import { createColumn, createEmptyDoc, createIdFactory, createSection } from "./factory";
import { validateDoc } from "./validate";

function docWithLeaf(leaf: Record<string, unknown>) {
  const newId = createIdFactory();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 1);
  const col = section.children[0] as ReturnType<typeof createColumn>;
  (col.children as unknown[]).push(leaf);
  doc.children.push(section);
  return doc;
}

describe("validateDoc — registered (extra) leaf types", () => {
  const custom = { id: "n1", type: "coupon", style: { paddingTop: 8 }, code: "SAVE10" };

  test("an unregistered custom leaf type is rejected by default", () => {
    const result = validateDoc(docWithLeaf(custom));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.message.includes('unknown leaf type "coupon"'))).toBe(
        true,
      );
    }
  });

  test("the same leaf is accepted when its type is allowed via extraLeafTypes", () => {
    const result = validateDoc(docWithLeaf(custom), { extraLeafTypes: ["coupon"] });
    expect(result.ok).toBe(true);
  });

  test("an allowed custom leaf still has its common shape validated (bad style)", () => {
    const bad = { id: "n2", type: "coupon", style: { paddingTop: "oops" } };
    const result = validateDoc(docWithLeaf(bad), { extraLeafTypes: ["coupon"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.path.includes(".style"))).toBe(true);
  });

  test("an allowed custom leaf still needs a valid id", () => {
    const bad = { type: "coupon", style: {} };
    const result = validateDoc(docWithLeaf(bad), { extraLeafTypes: ["coupon"] });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.some((e) => e.path.endsWith(".id"))).toBe(true);
  });
});
