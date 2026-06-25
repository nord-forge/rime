// Rime vanilla demo — proves the end-user UX on the PUBLIC surface only:
// <rime-editor> + the ENV-42 JSON in/out API + the ENV-43 onImageUpload contract +
// --eb-* theming, with a trivial localStorage store (no backend, per §6.10). It also
// registers the example custom block (ENV-37) to prove registerBlock end to end.

import { defineRimeEditor } from "@nord-forge/rime-core/register";
import type { RimeChangeDetail, RimeConfig, RimeDoc } from "@nord-forge/rime-core/register";
import { deserialize, serialize } from "@nord-forge/rime-model";
// docToMjml is the browser-safe doc→MJML step. The final MJML→HTML pass (mjml2html)
// is Node-only, so it runs server-side at export time, not in this demo.
import { docToMjml } from "@nord-forge/rime-mjml/browser";
import { blockRegistry, registryToMjmlRenderers } from "@nord-forge/rime-core";
import { couponBlock } from "./blocks/coupon-block";
import "./app.css";

defineRimeEditor({ blocks: [couponBlock] });

const STORAGE_KEY = "rime-demo-doc";

function starterDoc(): RimeDoc {
  return {
    id: "doc",
    type: "document",
    settings: { contentWidth: 600, backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" },
    children: [
      {
        id: "hero",
        type: "section",
        style: { paddingTop: 36, paddingBottom: 8, paddingLeft: 28, paddingRight: 28 },
        children: [
          {
            id: "hcol",
            type: "column",
            widthPercent: 100,
            style: {},
            children: [
              { id: "h1", type: "heading", level: 1, text: "Your first campaign", style: {} },
              {
                id: "p1",
                type: "text",
                style: {},
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Drag blocks from the left to build. " },
                        { type: "text", text: "Try the Coupon", marks: ["bold"] },
                        { type: "text", text: " — a custom block registered via the SDK." },
                      ],
                    },
                  ],
                },
              },
            ] as never,
          },
        ],
      },
      {
        id: "couponSec",
        type: "section",
        style: { paddingTop: 8, paddingBottom: 36, paddingLeft: 28, paddingRight: 28 },
        children: [
          {
            id: "couponCol",
            type: "column",
            widthPercent: 100,
            style: {},
            children: [
              {
                id: "coupon",
                type: "coupon",
                label: "10% off your order",
                code: "SAVE10",
                style: {},
              },
            ] as never,
          },
        ],
      },
    ],
  };
}

// --eb-* theme presets, applied to the chrome at runtime. The CANVAS (email styles)
// is unaffected — the two-surface model.
const THEMES: { id: string; label: string; theme: RimeConfig["theme"] }[] = [
  { id: "light", label: "Light", theme: {} },
  {
    id: "indigo",
    label: "Indigo",
    theme: {
      "--eb-color-accent": "#5b5bd6",
      "--eb-color-surface": "#f7f7fe",
      "--eb-radius": "10px",
    },
  },
  {
    id: "dark",
    label: "Dark",
    theme: {
      "--eb-color-bg": "#0c1020",
      "--eb-color-surface": "#161b2e",
      "--eb-color-fg": "#e7e9f5",
      "--eb-color-border": "#2a3150",
      "--eb-color-accent": "#8b8bf0",
    },
  },
];

// Stub uploader: returns an object URL — the host-uploader contract (ENV-43) with NO
// backend. A real app returns a CDN URL.
const onImageUpload = (file: File): Promise<string> => Promise.resolve(URL.createObjectURL(file));

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

const editor = document.createElement("rime-editor") as HTMLElement & {
  updateComplete: Promise<boolean>;
  whenCanvasReady(): Promise<unknown>;
  loadDoc(doc: RimeDoc): void;
  getDoc(): RimeDoc;
  config: RimeConfig;
};

let themeId = "light";
function applyConfig(): void {
  editor.config = { theme: THEMES.find((t) => t.id === themeId)?.theme, onImageUpload };
}
applyConfig();
$(".stage").append(editor);

// Autosave state pill.
let savedTimer: ReturnType<typeof setTimeout> | null = null;
function setSave(state: "idle" | "saving" | "saved"): void {
  $("#status").dataset["state"] = state;
  $("#status-label").textContent =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Up to date";
}

editor.addEventListener("change", (e) => {
  localStorage.setItem(STORAGE_KEY, serialize((e as CustomEvent<RimeChangeDetail>).detail.doc));
  setSave("saving");
  if (savedTimer) clearTimeout(savedTimer);
  savedTimer = setTimeout(() => setSave("saved"), 350);
});

function loadFromStore(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const result = deserialize(raw);
    if (result.ok) {
      editor.loadDoc(result.doc);
      return;
    }
  }
  editor.loadDoc(starterDoc());
}

void editor.updateComplete.then(() => editor.whenCanvasReady()).then(() => loadFromStore());

// ── Toolbar ──────────────────────────────────────────────────────────────────
$("#reset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  editor.loadDoc(starterDoc());
});

const seg = $("#theme");
for (const t of THEMES) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = t.label;
  b.setAttribute("aria-pressed", String(t.id === themeId));
  b.addEventListener("click", () => {
    themeId = t.id;
    applyConfig();
    for (const child of seg.children) {
      child.setAttribute("aria-pressed", String(child === b));
    }
  });
  seg.append(b);
}

// Export — show the portable MJML (incl. the custom coupon block via the registry's
// export renderers). The final MJML→HTML pass is server-side.
const dialog = $<HTMLDialogElement>("#export");
$("#export-btn").addEventListener("click", () => {
  $("#export-html").textContent = docToMjml(
    editor.getDoc(),
    {},
    registryToMjmlRenderers(blockRegistry),
  );
  dialog.showModal();
});
$("#export-close").addEventListener("click", () => dialog.close());
$("#export-copy").addEventListener("click", () => {
  const copy = $("#export-copy");
  void navigator.clipboard?.writeText($("#export-html").textContent ?? "").then(() => {
    copy.textContent = "Copied";
    setTimeout(() => (copy.textContent = "Copy"), 1200);
  });
});
