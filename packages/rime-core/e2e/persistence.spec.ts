import { expect, test } from "./fixtures";

// The public JSON in/out surface: loadDoc validates + replaces state without
// emitting `change`; getDoc round-trips; a user edit emits a coalesced `change`
// with the new doc. Real browser (chromium + webkit) — the element + canvas + rAF
// coalescing all behave per-engine.

const DOC = {
  id: "doc_1",
  type: "document",
  settings: { contentWidth: 600, backgroundColor: "#ffffff", fontFamily: "Arial" },
  children: [
    {
      id: "sec_1",
      type: "section",
      style: {},
      children: [
        {
          id: "col_1",
          type: "column",
          widthPercent: 100,
          style: {},
          children: [
            {
              id: "txt_1",
              type: "text",
              style: {},
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "hi" }] }],
              },
            },
          ],
        },
      ],
    },
  ],
};

test.describe("JSON in/out API", () => {
  test("loadDoc → getDoc round-trips and does not emit change", async ({ editor, page }) => {
    const changes = await page.evaluate(() => {
      const el = document.querySelector("rime-editor")!;
      (window as unknown as { __changes: number }).__changes = 0;
      el.addEventListener("change", () => {
        (window as unknown as { __changes: number }).__changes += 1;
      });
      return (window as unknown as { __changes: number }).__changes;
    });
    expect(changes).toBe(0);

    await editor.loadDoc(DOC);
    expect(await editor.getDoc()).toEqual(DOC);

    // loadDoc is host-driven, not a user edit — no change should have fired.
    const after = await page.evaluate(() => (window as unknown as { __changes: number }).__changes);
    expect(after).toBe(0);
  });

  test("loadDoc throws a typed error on an invalid doc", async ({ editor, page }) => {
    await editor.host.waitFor();
    const result = await page.evaluate(() => {
      const el = document.querySelector("rime-editor") as unknown as { loadDoc(d: unknown): void };
      try {
        // widthPercent must sum to ~100; a lone 50% column is invalid.
        el.loadDoc({
          id: "d",
          type: "document",
          settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
          children: [
            {
              id: "s",
              type: "section",
              style: {},
              children: [{ id: "c", type: "column", widthPercent: 50, style: {}, children: [] }],
            },
          ],
        });
        return { threw: false };
      } catch (e) {
        return {
          threw: true,
          name: (e as Error).name,
          hasErrors: Array.isArray((e as { errors?: unknown[] }).errors),
        };
      }
    });
    expect(result.threw).toBe(true);
    expect(result.name).toBe("RimeValidationError");
    expect(result.hasErrors).toBe(true);
  });

  test("a user edit emits one coalesced change with the new doc", async ({ editor, page }) => {
    await editor.loadDoc(DOC);
    await page.evaluate(() => {
      const el = document.querySelector("rime-editor")!;
      const w = window as unknown as { __count: number; __lastChildren: number };
      w.__count = 0;
      el.addEventListener("change", (e) => {
        w.__count += 1;
        w.__lastChildren = (
          e as CustomEvent<{ doc: { children: unknown[] } }>
        ).detail.doc.children.length;
      });
    });

    // A property edit (immediate op) on the selected block, applied N times in one
    // tick, should coalesce to a single change carrying the latest doc.
    await page.evaluate(() => {
      const el = document.querySelector("rime-editor") as unknown as {
        getDoc(): { children: unknown[] };
      };
      // Drive the public add path several times synchronously.
      const add = (el as unknown as { addBlock(t: string): void }).addBlock.bind(el);
      add("divider");
      add("divider");
      add("divider");
    });

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __count: number }).__count))
      .toBe(1);
  });
});
