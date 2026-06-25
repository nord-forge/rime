import { expect, test } from "./fixtures";

// The shell's three-region layout, parts, and --rime-* theming, verified in
// a real browser (chromium + webkit).
test.describe("editor shell", () => {
  test("renders palette / canvas / properties parts", async ({ editor }) => {
    await Promise.all(
      ["palette", "canvas", "properties"].map((part) =>
        expect(editor.host.locator(`[part="${part}"]`)).toBeAttached(),
      ),
    );
  });

  test("lays out as a three-column grid", async ({ editor }) => {
    const cols = await editor.host.evaluate(
      (host) => getComputedStyle(host).gridTemplateColumns.split(" ").length,
    );
    expect(cols).toBe(3);
  });

  test("config.theme applies --rime-* tokens to the host chrome", async ({ editor }) => {
    const borderColor = await editor.host.evaluate(async (host) => {
      const el = host as unknown as {
        config: { theme: Record<string, string> };
        updateComplete: Promise<unknown>;
      };
      el.config = { theme: { "--rime-color-border": "rgb(1, 2, 3)" } };
      await el.updateComplete; // let Lit apply the theme in willUpdate
      const palette = host.shadowRoot!.querySelector('[part="palette"]')!;
      return getComputedStyle(palette).borderInlineEndColor;
    });
    expect(borderColor).toBe("rgb(1, 2, 3)");
  });
});
