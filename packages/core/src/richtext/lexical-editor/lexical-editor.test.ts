import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import type { RichTextJSON } from "@enveloppe/doc-model";
import { mountLexical } from "./lexical-editor";

// Lexical's reconciler reads global `window`/`document`/DOM constructors, so the
// editor must run against a registered DOM (unlike the pure renderers, which take
// a Document by argument). Register happy-dom's globals for the suite, restore on
// teardown so no other suite inherits them.
let win: Window;
let blockEl: HTMLElement;
const saved: Record<string, unknown> = {};
const GLOBALS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "Node",
  "Text",
  "Event",
  "MutationObserver",
  "getComputedStyle",
  "DocumentFragment",
] as const;

beforeEach(() => {
  win = new Window();
  for (const key of GLOBALS) {
    saved[key] = (globalThis as Record<string, unknown>)[key];
    (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[key];
  }
  blockEl = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.append(blockEl as unknown as Node);
});

afterEach(() => {
  for (const key of GLOBALS) (globalThis as Record<string, unknown>)[key] = saved[key];
});

function doc(...paragraphs: RichTextJSON["content"]): RichTextJSON {
  return { type: "doc", content: paragraphs };
}

describe("mountLexical", () => {
  test("mounts onto the existing element, making it an editable textbox", () => {
    const mount = mountLexical(blockEl, doc({ type: "paragraph", content: [] }));
    expect(blockEl.getAttribute("contenteditable")).toBe("true");
    expect(blockEl.getAttribute("role")).toBe("textbox");
    expect(mount.editor.getRootElement()).toBe(blockEl);
    mount.destroy();
  });

  test("seeds synchronously from RichTextJSON (text + marks survive)", () => {
    const initial = doc({
      type: "paragraph",
      content: [
        { type: "text", text: "Hello " },
        { type: "text", text: "world", marks: ["bold", "italic"] },
      ],
    });
    const mount = mountLexical(blockEl, initial);
    const out = mount.toJSON();
    expect(out.content).toHaveLength(1);
    const runs = out.content[0]!.content!;
    expect(runs.map((r) => r.text).join("")).toBe("Hello world");
    const bold = runs.find((r) => r.marks?.includes("bold"));
    expect(bold).toBeDefined();
    expect(bold!.marks).toEqual(expect.arrayContaining(["bold", "italic"]));
    mount.destroy();
  });

  test("toJSON omits marks for unformatted runs", () => {
    const mount = mountLexical(
      blockEl,
      doc({ type: "paragraph", content: [{ type: "text", text: "plain" }] }),
    );
    const run = mount.toJSON().content[0]!.content![0]!;
    expect(run.text).toBe("plain");
    expect(run.marks).toBeUndefined();
    mount.destroy();
  });

  test("format() toggles a mark across the seeded text and reflects in toJSON", () => {
    const mount = mountLexical(
      blockEl,
      doc({ type: "paragraph", content: [{ type: "text", text: "abc" }] }),
    );
    mount.format("bold");
    const run = mount.toJSON().content[0]!.content![0]!;
    expect(run.marks).toContain("bold");
    // Toggling again clears it.
    mount.format("bold");
    expect(mount.toJSON().content[0]!.content![0]!.marks).toBeUndefined();
    mount.destroy();
  });

  test("round-trips multiple paragraphs", () => {
    const initial = doc(
      { type: "paragraph", content: [{ type: "text", text: "one" }] },
      { type: "paragraph", content: [{ type: "text", text: "two", marks: ["underline"] }] },
    );
    const out = mountLexical(blockEl, initial).toJSON();
    expect(out.content).toHaveLength(2);
    expect(out.content[1]!.content![0]!.marks).toEqual(["underline"]);
  });

  test("destroy() unbinds the root and strips editable attributes", () => {
    const mount = mountLexical(blockEl, doc({ type: "paragraph", content: [] }));
    mount.destroy();
    expect(mount.editor.getRootElement()).toBeNull();
    expect(blockEl.getAttribute("contenteditable")).toBeNull();
    expect(blockEl.getAttribute("role")).toBeNull();
  });

  test("destroy() is idempotent", () => {
    const mount = mountLexical(blockEl, doc({ type: "paragraph", content: [] }));
    mount.destroy();
    expect(() => mount.destroy()).not.toThrow();
  });
});
