import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
  insertNode,
  moveNode,
  updateNode,
} from "@enveloppe/doc-model";
import { CanvasRenderer } from "./canvas-renderer";

// Inject happy-dom's document — the renderer takes a Document by design, so no
// global registrator is needed.
let win: Window;
let doc: Document;
let mount: HTMLElement;

beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
  mount = doc.createElement("div");
  doc.body.append(mount);
});

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

/** Doc: one section, two 50% columns; col0 a text block, col1 a button. */
function buildDoc(): DocumentNode {
  const newId = ids();
  const d = createEmptyDoc(newId);
  const section = createSection(newId, 2);
  section.children[0]!.children.push(createTextBlock(newId));
  section.children[1]!.children.push(createButtonBlock(newId, "Go", "https://x.test"));
  d.children.push(section);
  return d;
}

describe("render shape", () => {
  test("paints document → section → columns → leaves with identity stamps", () => {
    const d = buildDoc();
    const r = new CanvasRenderer(mount, doc);
    r.render(d);

    const root = mount.querySelector("[data-node-id]") as HTMLElement;
    expect(root.dataset["nodeType"]).toBe("document");

    const section = d.children[0]!;
    expect(mount.querySelector(`[data-node-id="${section.id}"]`)).toBeTruthy();
    for (const col of section.children) {
      expect(mount.querySelector(`[data-node-id="${col.id}"]`)).toBeTruthy();
    }
  });

  test("columns lay out as flex with widthPercent basis", () => {
    const d = buildDoc();
    new CanvasRenderer(mount, doc).render(d);
    const col0 = mount.querySelector(
      `[data-node-id="${d.children[0]!.children[0]!.id}"]`,
    ) as HTMLElement;
    expect(col0.style.flexBasis).toBe("50%");
    const row = mount.querySelector('[data-node-role="column-row"]') as HTMLElement;
    expect(row.style.display).toBe("flex");
  });

  test("preview DOM contains NO <table>", () => {
    const d = buildDoc();
    new CanvasRenderer(mount, doc).render(d);
    expect(mount.querySelector("table")).toBeNull();
  });

  test("applies BlockStyle (padding/background) to elements", () => {
    const newId = ids();
    const d = createEmptyDoc(newId);
    const section = createSection(newId, 1);
    section.style = { paddingTop: 12, backgroundColor: "rgb(1, 2, 3)" };
    d.children.push(section);
    new CanvasRenderer(mount, doc).render(d);
    const secEl = mount.querySelector(`[data-node-id="${section.id}"]`) as HTMLElement;
    expect(secEl.style.paddingTop).toBe("12px");
    expect(secEl.style.backgroundColor).toBe("rgb(1, 2, 3)");
  });
});

describe("incremental update", () => {
  test("unchanged subtree keeps the SAME element reference", () => {
    const d = buildDoc();
    const r = new CanvasRenderer(mount, doc);
    r.render(d);

    const untouchedColId = d.children[0]!.children[1]!.id; // col1 (button side)
    const before = r.elementForNode(untouchedColId);

    // change only the text block in col0
    const textId = d.children[0]!.children[0]!.children[0]!.id;
    const next = updateNode(d, textId, { style: { paddingTop: 4 } }).doc;
    r.update(next);

    const after = r.elementForNode(untouchedColId);
    expect(after).toBe(before); // structural sharing → identical DOM element
  });

  test("changed leaf updates in place (same element, new props)", () => {
    const d = buildDoc();
    const r = new CanvasRenderer(mount, doc);
    r.render(d);
    const textId = d.children[0]!.children[0]!.children[0]!.id;
    const elBefore = r.elementForNode(textId);

    const next = updateNode(d, textId, { style: { paddingTop: 9 } }).doc;
    r.update(next);

    const elAfter = r.elementForNode(textId);
    expect(elAfter).toBe(elBefore);
    expect(elAfter!.style.paddingTop).toBe("9px");
  });

  test("moving a block reuses its existing element (identity preserved)", () => {
    const newId = ids();
    const d = createEmptyDoc(newId);
    const section = createSection(newId, 1);
    const col = section.children[0]!;
    col.children.push(createTextBlock(newId), createButtonBlock(newId), createTextBlock(newId));
    d.children.push(section);

    const r = new CanvasRenderer(mount, doc);
    r.render(d);
    const movedId = col.children[0]!.id;
    const before = r.elementForNode(movedId);

    const next = moveNode(d, movedId, col.id, 2).doc; // move first toward the end
    const newOrder = next.children[0]!.children[0]!.children.map((c) => c.id);
    r.update(next);

    const after = r.elementForNode(movedId);
    expect(after).toBe(before); // reused, not recreated
    // DOM order matches the doc's new child order exactly.
    const colEl = r.elementForNode(col.id)!;
    const domOrder = Array.from(colEl.children).map((c) => (c as HTMLElement).dataset["nodeId"]);
    expect(domOrder).toEqual(newOrder);
  });

  test("inserting a block adds exactly one element", () => {
    const d = buildDoc();
    const r = new CanvasRenderer(mount, doc);
    r.render(d);
    const col0 = d.children[0]!.children[0]!;
    const next = insertNode(
      d,
      col0.id,
      1,
      createButtonBlock(() => "btn_new"),
    ).doc;
    r.update(next);
    expect(r.elementForNode("btn_new")).toBeTruthy();
  });

  test("removing a block detaches its element", () => {
    const d = buildDoc();
    const r = new CanvasRenderer(mount, doc);
    r.render(d);
    const textId = d.children[0]!.children[0]!.children[0]!.id;
    expect(r.elementForNode(textId)).toBeTruthy();

    // remove the text block via a doc without it
    const next = structuredClone(d);
    next.children[0]!.children[0]!.children = [];
    r.update(next);
    expect(r.elementForNode(textId)).toBeNull();
  });
});

describe("unknown node type guard", () => {
  test("renders an inert placeholder without throwing", () => {
    const newId = ids();
    const d = createEmptyDoc(newId);
    const section = createSection(newId, 1);
    section.children[0]!.children.push({
      id: "weird_1",
      type: "video",
    } as never);
    d.children.push(section);

    const r = new CanvasRenderer(mount, doc);
    expect(() => r.render(d)).not.toThrow();
    const placeholder = mount.querySelector('[data-node-id="weird_1"]') as HTMLElement;
    expect(placeholder.dataset["nodeUnknown"]).toBe("1");
  });
});
