import { describe, expect, test } from "bun:test";
import {
  type ButtonBlock,
  createButtonBlock,
  createEmptyDoc,
  createSection,
  type DocumentNode,
} from "@nord-forge/rime-model";
import {
  createRawBlockRenderer,
  docToMjml,
  MjmlRenderer,
  rawTableFallback,
  RenderError,
} from "./index";

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

/** Doc: one section, one column, one button (the target for override). */
function docWithButton(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 1);
  section.children[0]!.children.push(createButtonBlock(newId, "Buy", "https://x.test"));
  doc.children.push(section);
  return doc;
}

const RAW_HTML = '<table role="presentation" width="100%"><tr><td>RAW COUPON</td></tr></table>';

describe("rawTableFallback", () => {
  test("wraps html in <mj-raw> verbatim", () => {
    expect(rawTableFallback(RAW_HTML)).toBe(`<mj-raw>${RAW_HTML}</mj-raw>`);
  });
});

describe("createRawBlockRenderer", () => {
  test("produces a BlockRenderer for the given type", () => {
    const r = createRawBlockRenderer<ButtonBlock>("button", () => RAW_HTML);
    expect(r.type).toBe("button");
  });

  test("rejects structural container types", () => {
    expect(() => createRawBlockRenderer("section", () => "")).toThrow(RenderError);
    expect(() => createRawBlockRenderer("column", () => "")).toThrow(RenderError);
    expect(() => createRawBlockRenderer("document", () => "")).toThrow(RenderError);
  });
});

describe("override a built-in via the registry", () => {
  test("docToMjml splices the raw HTML and drops the MJML button", () => {
    const raw = createRawBlockRenderer<ButtonBlock>("button", (node) => `<a>${node.label}</a>`);
    const src = docToMjml(docWithButton(), {}, [raw]);
    expect(src).toContain("<mj-raw><a>Buy</a></mj-raw>");
    expect(src).not.toContain("<mj-button");
  });

  test("compiled output contains the authored HTML verbatim", async () => {
    const raw = createRawBlockRenderer<ButtonBlock>("button", () => RAW_HTML);
    const html = await new MjmlRenderer({ blockRenderers: [raw] }).render(docWithButton());
    expect(html).toContain("RAW COUPON");
    expect(html).toContain('role="presentation"');
    // the raw renderer replaced the button — no MJML-generated button table here
    expect(html).not.toContain(">Buy<");
  });
});
