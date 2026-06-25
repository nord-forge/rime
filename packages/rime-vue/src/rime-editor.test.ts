import { describe, expect, test } from "bun:test";
import { mount } from "@vue/test-utils";
import { RimeEditor } from "./index";

// Thin-wrapper test: assert the prop/v-model/event BRIDGE against a STUB
// <rime-editor> (the real Lit editor needs a browser — e2e-tested in rime-core).
// ./test-setup.ts (bunfig preload) installs happy-dom globals AND registers the stub
// element BEFORE Vue / the `register` import load.
interface StubEditor extends HTMLElement {
  config: unknown;
  loaded: unknown[];
  __doc: unknown;
  loadDoc(d: unknown): void;
  getDoc(): unknown;
}

const DOC = { id: "d1", type: "document", children: [] } as never;

// Mount with Vue told that rime-editor is a custom element.
function mountEditor(props: Record<string, unknown>) {
  return mount(RimeEditor, {
    props,
    global: {
      config: { compilerOptions: { isCustomElement: (t: string) => t === "rime-editor" } },
    },
    attachTo: document.body,
  });
}

function stub(wrapper: ReturnType<typeof mountEditor>): StubEditor {
  return wrapper.element as unknown as StubEditor;
}

describe("<RimeEditor> Vue wrapper", () => {
  test("renders the <rime-editor> custom element", () => {
    const w = mountEditor({});
    expect(w.element.tagName.toLowerCase()).toBe("rime-editor");
    w.unmount();
  });

  test("maps theme/enabledBlocks/onImageUpload/lexicalEditor into config", () => {
    const onImageUpload = async () => "https://x/u.png";
    const w = mountEditor({
      theme: { "--eb-color-accent": "#abc" },
      enabledBlocks: ["text", "image"],
      onImageUpload,
      lexicalEditor: false,
    });
    const config = stub(w).config as Record<string, unknown>;
    expect(config["theme"]).toEqual({ "--eb-color-accent": "#abc" });
    expect(config["enabledBlocks"]).toEqual(["text", "image"]);
    expect(config["onImageUpload"]).toBe(onImageUpload);
    expect(config["lexicalEditor"]).toBe(false);
    w.unmount();
  });

  test("config updates when props change", async () => {
    const w = mountEditor({ theme: { "--eb-color-accent": "#111" } });
    expect((stub(w).config as Record<string, unknown>)["theme"]).toEqual({
      "--eb-color-accent": "#111",
    });
    await w.setProps({ theme: { "--eb-color-accent": "#222" } });
    expect((stub(w).config as Record<string, unknown>)["theme"]).toEqual({
      "--eb-color-accent": "#222",
    });
    w.unmount();
  });

  test("v-model: external modelValue loads on mount and on change", async () => {
    const w = mountEditor({ modelValue: DOC });
    expect(stub(w).loaded).toContain(DOC);
    const doc2 = { ...(DOC as object), id: "d2" } as never;
    await w.setProps({ modelValue: doc2 });
    expect(stub(w).loaded).toContain(doc2);
    w.unmount();
  });

  test("v-model: an editor change emits update:modelValue + change and does not loop back", async () => {
    const w = mountEditor({ modelValue: DOC });
    const e = stub(w);
    const loadsBefore = e.loaded.length;

    const fromEditor = { ...(DOC as object), id: "edited" } as never;
    e.dispatchEvent(new CustomEvent("change", { detail: { doc: fromEditor } }));

    expect(w.emitted("update:modelValue")?.[0]).toEqual([fromEditor]);
    expect(w.emitted("change")?.[0]).toEqual([fromEditor]);

    // Simulate the parent writing the v-model back; must NOT re-load it.
    await w.setProps({ modelValue: fromEditor });
    expect(e.loaded.length).toBe(loadsBefore);
    w.unmount();
  });

  test("removes the change listener on unmount (no leak)", () => {
    const w = mountEditor({ modelValue: DOC });
    const e = stub(w);
    w.unmount();
    e.dispatchEvent(new CustomEvent("change", { detail: { doc: DOC } }));
    expect(w.emitted("change")).toBeUndefined();
  });
});
