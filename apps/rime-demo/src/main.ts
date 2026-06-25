// Rime demo — proves the end-user experience on the PUBLIC surface only:
// <rime-editor> + the ENV-42 JSON in/out API + the ENV-43 onImageUpload contract +
// --eb-* theming, with a trivial localStorage store (no backend, per §6.10). It also
// registers the example custom block (ENV-37) to prove registerBlock end to end.

import { defineRimeEditor } from "@nord-forge/rime-core/register";
import type { RimeChangeDetail, RimeConfig, RimeDoc } from "@nord-forge/rime-core/register";
import { deserialize, serialize } from "@nord-forge/rime-model";
// docToMjml is the browser-safe doc→MJML step. The final MJML→HTML pass (mjml2html)
// is Node-only (fs/path), so it runs server-side at export time, not in this demo —
// we show the portable MJML the renderer would feed to mjml2html.
import { docToMjml } from "@nord-forge/rime-mjml/browser";
import { blockRegistry, registryToMjmlRenderers } from "@nord-forge/rime-core";
import { couponBlock } from "./blocks/coupon-block";

// Register the built-in blocks AND the example custom block, then define the element.
defineRimeEditor({ blocks: [couponBlock] });

const STORAGE_KEY = "rime-demo-doc";

// A starter document with a coupon, so the example is visible immediately.
function starterDoc(): RimeDoc {
  return {
    id: "doc",
    type: "document",
    settings: { contentWidth: 600, backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif" },
    children: [
      {
        id: "section",
        type: "section",
        style: { paddingTop: 24, paddingBottom: 24 },
        children: [
          {
            id: "column",
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
// is unaffected — proving the two-surface model.
const THEMES: Record<string, RimeConfig["theme"]> = {
  Default: {},
  "Brand purple": {
    "--eb-color-accent": "#7c3aed",
    "--eb-color-surface": "#faf5ff",
    "--eb-radius": "12px",
  },
  Dark: {
    "--eb-color-bg": "#18181b",
    "--eb-color-surface": "#27272a",
    "--eb-color-fg": "#e4e4e7",
    "--eb-color-border": "#3f3f46",
    "--eb-color-accent": "#22d3ee",
  },
};

// Stub uploader: returns an object URL for the picked file — proving the host-uploader
// contract (ENV-43) with NO backend. A real app returns a CDN URL here.
const onImageUpload = (file: File): Promise<string> => Promise.resolve(URL.createObjectURL(file));

const $ = <T extends HTMLElement>(sel: string): T => document.querySelector<T>(sel)!;

function flash(msg: string): void {
  const status = $("#status");
  status.textContent = msg;
  setTimeout(() => (status.textContent = ""), 1500);
}

const app = $("#app");
const editor = document.createElement("rime-editor") as HTMLElement & {
  updateComplete: Promise<boolean>;
  whenCanvasReady(): Promise<unknown>;
  loadDoc(doc: RimeDoc): void;
  getDoc(): RimeDoc;
  config: RimeConfig;
};
editor.style.blockSize = "100%";
editor.style.minBlockSize = "0";

let themeName = "Default";
function applyConfig(): void {
  editor.config = { theme: THEMES[themeName], onImageUpload };
}
applyConfig();
app.append(editor);

// Persist every edit to localStorage (serialize on `change`; coalesced upstream).
editor.addEventListener("change", (e) => {
  localStorage.setItem(STORAGE_KEY, serialize((e as CustomEvent<RimeChangeDetail>).detail.doc));
});

// Load from localStorage if present + valid, else the starter doc.
function loadFromStore(): void {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const result = deserialize(raw);
    if (result.ok) {
      editor.loadDoc(result.doc);
      flash("Loaded");
      return;
    }
  }
  editor.loadDoc(starterDoc());
}

// Wait for Lit to render the element (which creates the canvas in firstUpdated)
// before reaching for whenCanvasReady(), then load the stored/starter doc.
void editor.updateComplete.then(() => editor.whenCanvasReady()).then(() => loadFromStore());

// ── Toolbar wiring ─────────────────────────────────────────────────────────
$("#save").addEventListener("click", () => {
  localStorage.setItem(STORAGE_KEY, serialize(editor.getDoc()));
  flash("Saved");
});
$("#load").addEventListener("click", () => loadFromStore());
$("#reset").addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  editor.loadDoc(starterDoc());
  flash("Reset");
});

const themeSelect = $<HTMLSelectElement>("#theme");
for (const name of Object.keys(THEMES)) {
  const opt = document.createElement("option");
  opt.value = name;
  opt.textContent = name;
  themeSelect.append(opt);
}
themeSelect.addEventListener("change", () => {
  themeName = themeSelect.value;
  applyConfig();
});

// Export — show the portable MJML the renderer produces (incl. the custom coupon
// block via the registry's export renderers). The final MJML→HTML pass is a
// server-side step (mjml is Node-only), so the demo stops at the MJML markup.
const dialog = $<HTMLDialogElement>("#export");
$("#export-btn").addEventListener("click", () => {
  const mjml = docToMjml(editor.getDoc(), {}, registryToMjmlRenderers(blockRegistry));
  $("#export-html").textContent = mjml;
  dialog.showModal();
});
$("#export-close").addEventListener("click", () => dialog.close());
$("#export-copy").addEventListener("click", () => {
  void navigator.clipboard?.writeText($("#export-html").textContent ?? "");
  flash("Copied");
});
