import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { RimeEditor, type RimeEditorHandle } from "./index";

// A thin wrapper test: we assert the prop/event/ref BRIDGE, not the real editor (the
// Lit <rime-editor> needs a real browser — it's e2e-tested in rime-core). So we
// register a minimal STUB <rime-editor> in happy-dom that records what the wrapper
// drives. The stub is defined before each test, so React mounts/upgrades it.
const saved: Record<string, unknown> = {};
const GLOBALS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "customElements",
  "Node",
  "Event",
  "CustomEvent",
  "MutationObserver",
  "getComputedStyle",
] as const;

interface StubEditor extends HTMLElement {
  config: unknown;
  loaded: unknown[];
  __doc: unknown;
  loadDoc(d: unknown): void;
  getDoc(): unknown;
}

let win: Window;
let container: HTMLElement;
let root: Root;

beforeEach(() => {
  win = new Window();
  for (const key of GLOBALS) {
    saved[key] = (globalThis as Record<string, unknown>)[key];
    (globalThis as Record<string, unknown>)[key] = (win as unknown as Record<string, unknown>)[key];
  }
  (globalThis as Record<string, unknown>)["IS_REACT_ACT_ENVIRONMENT"] = true;

  // Register the stub element in happy-dom's registry. The real defineRimeEditor()
  // (from the static `register` import) ran against the pre-test global registry, so
  // it doesn't collide here.
  const Stub = class extends (win.HTMLElement as unknown as typeof HTMLElement) {
    config: unknown = undefined;
    loaded: unknown[] = [];
    __doc: unknown = undefined;
    loadDoc(d: unknown): void {
      this.loaded.push(d);
      this.__doc = d;
    }
    getDoc(): unknown {
      return this.__doc;
    }
  };
  win.customElements.define("rime-editor", Stub as never);

  container = win.document.createElement("div") as unknown as HTMLElement;
  win.document.body.append(container as unknown as Node);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  for (const key of GLOBALS) (globalThis as Record<string, unknown>)[key] = saved[key];
});

function el(): StubEditor {
  return container.querySelector("rime-editor") as unknown as StubEditor;
}

const DOC = { id: "d1", type: "document", children: [] } as never;

describe("<RimeEditor> wrapper", () => {
  test("renders the <rime-editor> custom element", () => {
    act(() => root.render(<RimeEditor />));
    expect(container.querySelector("rime-editor")).not.toBeNull();
  });

  test("maps theme/enabledBlocks/onImageUpload/lexicalEditor into config", () => {
    const onImageUpload = async () => "https://x/u.png";
    act(() =>
      root.render(
        <RimeEditor
          theme={{ "--rime-color-accent": "#abc" }}
          enabledBlocks={["text", "image"]}
          onImageUpload={onImageUpload}
          lexicalEditor={false}
        />,
      ),
    );
    const config = el().config as Record<string, unknown>;
    expect(config["theme"]).toEqual({ "--rime-color-accent": "#abc" });
    expect(config["enabledBlocks"]).toEqual(["text", "image"]);
    expect(config["onImageUpload"]).toBe(onImageUpload);
    expect(config["lexicalEditor"]).toBe(false);
  });

  test("config updates when props change", () => {
    act(() => root.render(<RimeEditor theme={{ "--rime-color-accent": "#111" }} />));
    expect((el().config as Record<string, unknown>)["theme"]).toEqual({
      "--rime-color-accent": "#111",
    });
    act(() => root.render(<RimeEditor theme={{ "--rime-color-accent": "#222" }} />));
    expect((el().config as Record<string, unknown>)["theme"]).toEqual({
      "--rime-color-accent": "#222",
    });
  });

  test("controlled doc loads on mount and when it changes", () => {
    act(() => root.render(<RimeEditor doc={DOC} />));
    expect(el().loaded).toContain(DOC);
    const doc2 = { ...(DOC as object), id: "d2" } as never;
    act(() => root.render(<RimeEditor doc={doc2} />));
    expect(el().loaded).toContain(doc2);
  });

  test("change surfaces via onChange and does not loop back as a load", () => {
    const changes: unknown[] = [];
    act(() => root.render(<RimeEditor doc={DOC} onChange={(d) => changes.push(d)} />));
    const e = el();
    const loadsBefore = e.loaded.length;

    const fromEditor = { ...(DOC as object), id: "edited" } as never;
    act(() => {
      e.dispatchEvent(new CustomEvent("change", { detail: { doc: fromEditor } }));
    });
    expect(changes).toContain(fromEditor);

    // Re-render with the doc that came FROM the editor: must not echo back as a load.
    act(() => root.render(<RimeEditor doc={fromEditor} onChange={(d) => changes.push(d)} />));
    expect(e.loaded.length).toBe(loadsBefore); // no new load
  });

  test("forwarded ref exposes getDoc/loadDoc", () => {
    const ref = createRef<RimeEditorHandle>();
    act(() => root.render(<RimeEditor ref={ref} />));
    expect(ref.current).not.toBeNull();
    ref.current!.loadDoc(DOC);
    expect(el().loaded).toContain(DOC);
    expect(ref.current!.getDoc()).toBe(DOC);
  });

  test("removes the change listener on unmount (no leak)", () => {
    const changes: unknown[] = [];
    act(() => root.render(<RimeEditor onChange={(d) => changes.push(d)} />));
    const e = el();
    act(() => root.unmount());
    e.dispatchEvent(new CustomEvent("change", { detail: { doc: DOC } }));
    expect(changes).toHaveLength(0);
    root = createRoot(container); // afterEach unmount stays safe
  });
});
