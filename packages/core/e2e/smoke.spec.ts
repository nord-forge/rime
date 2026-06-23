import { expect, test } from "./fixtures";

// Build-success ≠ runs. Cross-browser smoke: the harness mounts the element in
// BOTH chromium and webkit and the load/get-doc round-trip works through the real
// element instance. (The canvas iframe arrives in ENV-15; see editor-shell.spec.)
test.describe("editor harness smoke", () => {
  test("element is defined and visible", async ({ editor, page }) => {
    await expect(editor.host).toBeVisible();
    const defined = await page.evaluate(() => !!customElements.get("enveloppe-editor"));
    expect(defined).toBe(true);
  });

  test("loadDoc / getDoc round-trips through the element", async ({ editor }) => {
    const doc = {
      id: "d1",
      type: "document",
      settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
      children: [],
    };
    await editor.loadDoc(doc);
    expect(await editor.getDoc()).toEqual(doc);
  });
});
