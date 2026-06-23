import { expect, test } from "./fixtures";

// Build-success ≠ runs. This cross-browser smoke proves the harness mounts the
// element and the canvas iframe is live in BOTH chromium and webkit, and that
// the load/get-doc round-trip works through the real element instance.
test.describe("editor harness smoke", () => {
  test("element is visible and the canvas iframe is present", async ({ editor }) => {
    await expect(editor.host).toBeVisible();
    const frame = editor.canvasFrame();
    // The iframe's body must be reachable (proves a real same-origin srcdoc frame).
    await expect(frame.locator("body")).toBeAttached();
  });

  test("loadDoc / getDoc round-trips through the element", async ({ editor }) => {
    const doc = { version: 1, doc: { id: "d1", type: "document" } };
    await editor.loadDoc(doc);
    expect(await editor.getDoc()).toEqual(doc);
  });
});
