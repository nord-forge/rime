import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { createColumn, createIdFactory, createSection, validateDoc } from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { MjmlRenderer } from "@nord-forge/rime-mjml";
import { BlockRegistry, registryToMjmlRenderers } from "../registry";
import type { CanvasRenderContext, ExportRenderContext } from "../types";
import { registerCoreBlocks, tableBlock } from "./index";
import type { TableBlock } from "./table";

let win: Window;
let doc: Document;
beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
});

function canvasCtx(): CanvasRenderContext {
  return { doc, renderChild: () => doc.createElement("div") };
}

const exportCtx: ExportRenderContext = {
  renderChild: () => "",
  escape: (s) => s,
};

function makeTable(over: Partial<TableBlock> = {}): TableBlock {
  return {
    id: "t1",
    type: "table",
    rows: [
      ["A", "B"],
      ["C", "D"],
    ],
    header: false,
    border: "thin",
    style: {},
    ...over,
  };
}

function docWithLeaf(leaf: BaseNode) {
  const id = createIdFactory();
  const section = createSection(id, 1);
  (section.children[0] as ReturnType<typeof createColumn>).children.push(leaf as never);
  return {
    id: id("document"),
    type: "document" as const,
    settings: { contentWidth: 600, backgroundColor: "#ffffff", fontFamily: "Arial" },
    children: [section],
  };
}

describe("table block schema", () => {
  test("exposes rows (list) + header + border + padding", () => {
    const keys = tableBlock.schema.fields.map((f) => f.key);
    expect(keys).toEqual(["rows", "header", "border", "style.paddingTop"]);
    expect(tableBlock.schema.fields.find((f) => f.key === "rows")?.type).toBe("list");
    expect(tableBlock.schema.fields.find((f) => f.key === "header")?.type).toBe("boolean");
  });
});

describe("table block renderCanvas", () => {
  test("paints a real <table> with the cell grid and data-node-id (the §6.2 exception)", () => {
    const el = tableBlock.renderCanvas(makeTable(), canvasCtx());
    expect(el.dataset["nodeId"]).toBe("t1");
    const table = el.querySelector("table")!;
    expect(table).not.toBeNull();
    expect(table.querySelectorAll("tr")).toHaveLength(2);
    expect(table.querySelectorAll("td")).toHaveLength(4);
    expect(table.querySelector("th")).toBeNull(); // header off
    expect(table.querySelector("td")!.textContent).toBe("A");
  });

  test("renders the first row as <th> when header is on", () => {
    const el = tableBlock.renderCanvas(makeTable({ header: true }), canvasCtx());
    const table = el.querySelector("table")!;
    expect(table.querySelectorAll("th")).toHaveLength(2); // first row
    expect(table.querySelectorAll("td")).toHaveLength(2); // second row
  });
});

describe("table block renderExport", () => {
  test("returns { raw } wrapping an email-safe <table> in <mj-raw>, escaping cells", () => {
    const out = tableBlock.renderExport(makeTable({ rows: [["<b>", "A & B"]] }), exportCtx);
    expect("raw" in out).toBe(true);
    const raw = "raw" in out ? out.raw : "";
    expect(raw.startsWith("<mj-raw>")).toBe(true);
    expect(raw).toContain("<table");
    expect(raw).toContain("&lt;b&gt;");
    expect(raw).toContain("A &amp; B");
  });

  test("emits <th> for the header row and the chosen border", () => {
    const out = tableBlock.renderExport(makeTable({ header: true, border: "thick" }), exportCtx);
    const raw = "raw" in out ? out.raw : "";
    expect(raw).toContain("<th");
    expect(raw).toContain("2px solid #888888");
  });

  test("no-border maps to border:0", () => {
    const out = tableBlock.renderExport(makeTable({ border: "none" }), exportCtx);
    expect("raw" in out && out.raw).toContain("border:0");
  });
});

describe("table validateDoc round-trip (extraLeafTypes)", () => {
  test("the dropped default is valid", () => {
    const result = validateDoc(docWithLeaf(makeTable()), { extraLeafTypes: ["table"] });
    expect(result.ok).toBe(true);
  });
});

describe("table MJML export compiles through the renderer", () => {
  const registry = new BlockRegistry();
  registerCoreBlocks(registry);
  const renderer = new MjmlRenderer({ blockRenderers: registryToMjmlRenderers(registry) });

  test("a table document renders to HTML with the cell values", async () => {
    const html = await renderer.render(
      docWithLeaf(makeTable({ rows: [["Price", "Qty"]], header: true })),
    );
    expect(html).toContain("Price");
    expect(html).toContain("Qty");
  });
});
