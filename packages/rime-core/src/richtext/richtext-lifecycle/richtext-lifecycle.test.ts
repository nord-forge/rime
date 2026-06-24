import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  createColumn,
  createEmptyDoc,
  createIdFactory,
  createSection,
  createTextBlock,
  type RichTextJSON,
  type RimeDoc,
} from "@nord-forge/rime-model";
import { type LexicalMount, type Mounter, RichTextLifecycle } from "./richtext-lifecycle";

// A fake mount that records lifecycle order and a shared live-instance counter, so
// we can assert the hard invariant — at most one live editor — without spinning up
// real Lexical. The real mounter is exercised by the e2e (chromium + webkit).
interface Probe {
  live: number; // current live count (must never exceed 1)
  peak: number; // highest live count ever observed
  events: string[]; // "mount:<id>" / "destroy:<id>" / "toJSON:<id>"
}

function fakeMounter(probe: Probe, content: () => RichTextJSON): Mounter {
  return (el: HTMLElement, initial: RichTextJSON): LexicalMount => {
    const id = el.dataset["nodeId"] ?? "?";
    probe.live += 1;
    probe.peak = Math.max(probe.peak, probe.live);
    probe.events.push(`mount:${id}`);
    void initial;
    let destroyed = false;
    return {
      // Minimal stand-ins; the lifecycle only ever calls toJSON + destroy.
      editor: {} as LexicalMount["editor"],
      format() {},
      toJSON() {
        probe.events.push(`toJSON:${id}`);
        return content();
      },
      destroy() {
        if (destroyed) return;
        destroyed = true;
        probe.live -= 1;
        probe.events.push(`destroy:${id}`);
      },
    };
  };
}

let win: Window;
let doc: Document;
let doc0: RimeDoc; // the rime document (model), distinct from the DOM `doc`
let blocks: Record<string, HTMLElement>;

// Build a doc with three text blocks (t0,t1,t2) and matching iframe elements.
beforeEach(() => {
  win = new Window();
  doc = win.document as unknown as Document;
  const newId = createIdFactory();
  const rdoc = createEmptyDoc(newId);
  const section = createSection(newId, 1);
  const col = section.children[0] as ReturnType<typeof createColumn>;
  blocks = {};
  for (let i = 0; i < 3; i++) {
    const tb = createTextBlock(newId, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: `block ${i}` }] }],
    });
    col.children.push(tb);
    const el = doc.createElement("div") as unknown as HTMLElement;
    el.dataset["nodeId"] = tb.id;
    el.dataset["nodeType"] = "text";
    doc.body.append(el as unknown as Node);
    blocks[tb.id] = el;
  }
  rdoc.children.push(section);
  doc0 = rdoc;
});

function ids(): string[] {
  return Object.keys(blocks);
}

function makeLifecycle(probe: Probe, commits: Array<[string, RichTextJSON]> = []) {
  return new RichTextLifecycle({
    getDoc: () => doc0,
    elementForNode: (id) => blocks[id] ?? null,
    onCommit: (id, json) => commits.push([id, json]),
    mount: fakeMounter(probe, () => ({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "edited" }] }],
    })),
  });
}

describe("RichTextLifecycle", () => {
  test("focusing a TextBlock mounts exactly one editor on it", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    const [a] = ids();
    lc.focus(a!);
    expect(probe.live).toBe(1);
    expect(lc.activeNodeId).toBe(a!);
    expect(probe.events).toEqual([`mount:${a}`]);
  });

  test("focusing another block destroys the previous BEFORE mounting the new one", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    const [a, b] = ids();
    lc.focus(a!);
    lc.focus(b!);
    // destroy of a precedes mount of b in the event log.
    expect(probe.events).toEqual([`mount:${a}`, `toJSON:${a}`, `destroy:${a}`, `mount:${b}`]);
    expect(probe.live).toBe(1);
    expect(lc.activeNodeId).toBe(b!);
  });

  test("at most one instance is ever live across many focus changes", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    const [a, b, c] = ids();
    // Click through all three, repeatedly.
    for (const id of [a, b, c, a, c, b, a]) lc.focus(id!);
    expect(probe.peak).toBe(1);
    expect(probe.live).toBe(1);
  });

  test("blur destroys the active editor and fires onCommit with current toJSON", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const commits: Array<[string, RichTextJSON]> = [];
    const lc = makeLifecycle(probe, commits);
    const [a] = ids();
    lc.focus(a!);
    lc.blur();
    expect(probe.live).toBe(0);
    expect(lc.activeNodeId).toBeNull();
    expect(commits).toHaveLength(1);
    expect(commits[0]![0]).toBe(a!);
    expect(commits[0]![1].content[0]!.content![0]!.text).toBe("edited");
    // commit (toJSON) happens before destroy.
    expect(probe.events).toEqual([`mount:${a}`, `toJSON:${a}`, `destroy:${a}`]);
  });

  test("re-focusing the already-active block is a no-op (no churn)", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    const [a] = ids();
    lc.focus(a!);
    lc.focus(a!);
    lc.focus(a!);
    expect(probe.events).toEqual([`mount:${a}`]); // single mount, no destroy/recreate
    expect(probe.live).toBe(1);
  });

  test("blur with nothing active is a harmless no-op", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    expect(() => lc.blur()).not.toThrow();
    expect(probe.events).toEqual([]);
  });

  test("blur is deferred while composing and flushes on composition end", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    const [a] = ids();
    lc.focus(a!);
    lc.setComposing(true);
    lc.blur(); // requested mid-composition → deferred
    expect(probe.live).toBe(1);
    expect(lc.activeNodeId).toBe(a!);
    lc.setComposing(false); // composition ends → pending blur flushes
    expect(probe.live).toBe(0);
    expect(lc.activeNodeId).toBeNull();
  });

  test("destroy() tears down even while composing", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    lc.focus(ids()[0]!);
    lc.setComposing(true);
    lc.destroy();
    expect(probe.live).toBe(0);
  });

  test("focusing a missing element does not mount (and clears prior active)", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    const [a] = ids();
    lc.focus(a!);
    lc.focus("does-not-exist");
    // Prior was blurred/destroyed; nothing new mounted.
    expect(probe.live).toBe(0);
    expect(lc.activeNodeId).toBeNull();
  });

  test("onActiveChange fires with the mount on focus and null on blur", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const changes: Array<"mount" | "null"> = [];
    const lc = new RichTextLifecycle({
      getDoc: () => doc0,
      elementForNode: (id) => blocks[id] ?? null,
      onCommit: () => {},
      onActiveChange: (active) => changes.push(active ? "mount" : "null"),
      mount: fakeMounter(probe, () => ({ type: "doc", content: [] })),
    });
    const [a, b] = ids();
    lc.focus(a!);
    expect(lc.activeMount).not.toBeNull();
    lc.focus(b!); // blur a (null) then mount b
    lc.blur();
    expect(lc.activeMount).toBeNull();
    expect(changes).toEqual(["mount", "null", "mount", "null"]);
  });

  test("destroy() blurs the active editor and refuses further focus", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    const [a, b] = ids();
    lc.focus(a!);
    lc.destroy();
    expect(probe.live).toBe(0);
    lc.focus(b!); // ignored after destroy
    expect(probe.live).toBe(0);
    expect(lc.activeNodeId).toBeNull();
  });

  test("blur repaints the block's static view after destroy", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const repainted: string[] = [];
    const lc = new RichTextLifecycle({
      getDoc: () => doc0,
      elementForNode: (id) => blocks[id] ?? null,
      onCommit: () => {},
      repaint: (id) => repainted.push(id),
      mount: fakeMounter(probe, () => ({ type: "doc", content: [] })),
    });
    const [a, b] = ids();
    lc.focus(a!);
    lc.focus(b!); // blurs a → should repaint a
    expect(repainted).toContain(a!);
  });

  test("destroy() is idempotent", () => {
    const probe: Probe = { live: 0, peak: 0, events: [] };
    const lc = makeLifecycle(probe);
    lc.focus(ids()[0]!);
    lc.destroy();
    expect(() => lc.destroy()).not.toThrow();
  });
});
