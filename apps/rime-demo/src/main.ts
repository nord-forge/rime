// Rime demo entry. For now it proves the editor embeds and that the EXAMPLE custom
// block (ENV-37) works end to end through the public SDK: the Coupon block is
// registered via `defineRimeEditor({ blocks })`, then appears in the palette, gets a
// schema-driven properties form, previews on the canvas, and exports. The full
// end-user UX (local store, theme showcase, image upload) is built out in ENV-46.

import { defineRimeEditor } from "@nord-forge/rime-core/register";
import type { RimeDoc } from "@nord-forge/rime-core";
import { couponBlock } from "./blocks/coupon-block";

// Register the built-in blocks AND our example custom block, then define the element.
defineRimeEditor({ blocks: [couponBlock] });

// A starter document: one section/column holding a coupon, so the example is visible
// immediately (and you can also drag a fresh one from the "Marketing" palette group).
const STARTER_DOC: RimeDoc = {
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
          // The coupon node — a custom block living happily beside the built-ins.
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

const app = document.querySelector<HTMLElement>("#app");
if (app) {
  const editor = document.createElement("rime-editor") as HTMLElement & {
    whenCanvasReady(): Promise<unknown>;
    loadDoc(doc: RimeDoc): void;
  };
  editor.style.blockSize = "100vh";
  app.append(editor);
  void editor.whenCanvasReady().then(() => editor.loadDoc(STARTER_DOC));
}
