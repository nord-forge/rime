import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { renderPreviewCard } from "./drag-preview";

function doc(): Document {
  return new Window().document as unknown as Document;
}

describe("renderPreviewCard", () => {
  test("palette item shows the block's icon + label", () => {
    const card = renderPreviewCard(doc(), { source: "palette", blockType: "button" });
    expect(card.dataset["rimeOverlay"]).toBe("drag-preview");
    expect(card.textContent).toContain("Button");
  });

  test("unknown palette type falls back to the type as label", () => {
    const card = renderPreviewCard(doc(), { source: "palette", blockType: "coupon" as never });
    expect(card.textContent).toContain("coupon");
  });

  test("canvas block shows a generic moving label", () => {
    const card = renderPreviewCard(doc(), { source: "canvas", nodeId: "n1" });
    expect(card.textContent).toContain("Moving");
  });

  // Note: the --rime-* token styling is asserted in the browser by
  // e2e/drag-preview.spec.ts — happy-dom's CSSOM drops var() values for typed
  // color/length properties, so it can't verify theming here.
  test("renders an icon span + a label span", () => {
    const card = renderPreviewCard(doc(), { source: "palette", blockType: "image" });
    expect(card.querySelectorAll("span")).toHaveLength(2);
  });
});
