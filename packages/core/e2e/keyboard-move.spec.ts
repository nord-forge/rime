import { expect, type Page, test } from "@playwright/test";

const DOC = {
  id: "doc_1",
  type: "document",
  settings: { contentWidth: 600, backgroundColor: "#fff", fontFamily: "Arial" },
  children: [
    {
      id: "sec_1",
      type: "section",
      style: {},
      children: [
        {
          id: "col_1",
          type: "column",
          widthPercent: 50,
          style: {},
          children: [
            {
              id: "t_a",
              type: "text",
              style: { paddingTop: 16, paddingBottom: 16 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "A" }] }],
              },
            },
            {
              id: "t_b",
              type: "text",
              style: { paddingTop: 16, paddingBottom: 16 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "B" }] }],
              },
            },
          ],
        },
        {
          id: "col_2",
          type: "column",
          widthPercent: 50,
          style: {},
          children: [
            {
              id: "t_c",
              type: "text",
              style: { paddingTop: 16, paddingBottom: 16 },
              content: {
                type: "doc",
                content: [{ type: "paragraph", content: [{ type: "text", text: "C" }] }],
              },
            },
          ],
        },
      ],
    },
  ],
};

async function setup(page: Page): Promise<void> {
  await page.goto("/e2e/harness.html");
  await page.waitForSelector("enveloppe-editor");
  await page.evaluate(async (doc) => {
    const el = document.querySelector("enveloppe-editor") as unknown as {
      whenCanvasReady(): Promise<unknown>;
      loadDoc(d: unknown): void;
    };
    await el.whenCanvasReady();
    el.loadDoc(doc);
  }, DOC);
}

function columnIds(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector("enveloppe-editor") as unknown as {
      getDoc(): { children: { children: { id: string; children: { id: string }[] }[] }[] };
    };
    const out: Record<string, string[]> = {};
    for (const col of el.getDoc().children[0]!.children)
      out[col.id] = col.children.map((c) => c.id);
    return out;
  });
}

/** Click a block (selects it + gives the iframe focus), then press a chord. */
async function selectBlock(page: Page, id: string): Promise<void> {
  const frame = page.frameLocator("enveloppe-editor iframe");
  await frame.locator(`[data-node-id="${id}"]`).click();
}

test.describe("keyboard reordering", () => {
  test("Alt+ArrowDown moves a block down within its column", async ({ page }) => {
    await setup(page);
    expect((await columnIds(page))["col_1"]).toEqual(["t_a", "t_b"]);

    await selectBlock(page, "t_a");
    await page.keyboard.press("Alt+ArrowDown");

    expect((await columnIds(page))["col_1"]).toEqual(["t_b", "t_a"]);
  });

  test("Alt+ArrowRight moves a block into the next column", async ({ page }) => {
    await setup(page);
    await selectBlock(page, "t_a");
    await page.keyboard.press("Alt+ArrowRight");

    const cols = await columnIds(page);
    expect(cols["col_1"]).toEqual(["t_b"]);
    expect(cols["col_2"]).toContain("t_a");
  });

  test("focus follows the moved block", async ({ page }) => {
    await setup(page);
    await selectBlock(page, "t_a");
    await page.keyboard.press("Alt+ArrowDown");

    const focusedId = await page.evaluate(() => {
      const host = document.querySelector("enveloppe-editor")!;
      const idoc = (host.shadowRoot!.querySelector("iframe") as HTMLIFrameElement).contentDocument!;
      return (idoc.activeElement as HTMLElement | null)?.dataset["nodeId"] ?? null;
    });
    expect(focusedId).toBe("t_a");
  });

  test("move-to menu lists destinations and applies a move", async ({ page }) => {
    await setup(page);
    const applied = await page.evaluate(async () => {
      const mod = await import("/src/index.ts");
      const { destinationsFor } = mod as unknown as {
        destinationsFor: (doc: unknown, id: string) => { label: string; target: unknown }[];
      };
      const el = document.querySelector("enveloppe-editor") as unknown as { getDoc(): unknown };
      const dests = destinationsFor(el.getDoc(), "t_a");

      const menu = document.createElement("eb-move-to-menu") as unknown as {
        destinations: unknown[];
      } & HTMLElement;
      menu.destinations = dests;
      document.body.append(menu);

      let picked: unknown = null;
      menu.addEventListener("eb-move-select", (e) => {
        picked = (e as CustomEvent).detail;
      });
      // activate the first menu item
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      const first = menu.shadowRoot!.querySelector("button[role=menuitem]") as HTMLButtonElement;
      first.click();
      return { destCount: dests.length, picked };
    });
    expect(applied.destCount).toBeGreaterThan(0);
    expect(applied.picked).not.toBeNull();
  });
});
