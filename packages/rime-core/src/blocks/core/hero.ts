import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { applyStyle, el } from "../../canvas/render-node/render-node";
import { attrsToString, escapeAttr, escapeHtml, normalizeHref } from "./mjml-attrs";

export interface HeroButton {
  label: string;
  href: string;
}

export interface HeroBlock extends BaseNode {
  type: "hero";
  backgroundImage?: string;
  // Always present: the solid fallback for clients (Outlook/Windows especially)
  // that drop the background image, so the hero stays legible without it.
  backgroundColor: string;
  heading: string;
  subtext?: string;
  button?: HeroButton;
  height: number;
  textColor?: string;
  style: BlockStyle;
}

const DEFAULT_BG = "#333333";
const DEFAULT_TEXT = "#ffffff";
const DEFAULT_HEIGHT = 300;

function align(style: BlockStyle): "left" | "center" | "right" {
  return style.align ?? "center";
}

export const heroBlock: BlockDefinition<HeroBlock> = {
  type: "hero",
  // A hero is a full-bleed band: MJML's <mj-hero> is a body-level sibling of
  // sections, never nested in a column — so it lives at the document level.
  placement: "section",
  palette: {
    label: "Hero",
    icon: "🏞",
    category: "Content",
    defaults: {
      backgroundColor: DEFAULT_BG,
      heading: "Big headline",
      height: DEFAULT_HEIGHT,
      textColor: DEFAULT_TEXT,
      style: { align: "center" },
    },
  },
  schema: {
    fields: [
      { key: "backgroundImage", label: "Background image", type: "url", group: "Content" },
      { key: "backgroundColor", label: "Background", type: "color", group: "Colors" },
      { key: "heading", label: "Heading", type: "text", group: "Content" },
      { key: "subtext", label: "Subtext", type: "text", group: "Content" },
      { key: "button.label", label: "Button label", type: "text", group: "Content" },
      { key: "button.href", label: "Button link", type: "url", group: "Content" },
      { key: "height", label: "Height", type: "number", group: "Layout", min: 80, step: 10 },
      { key: "textColor", label: "Text color", type: "color", group: "Colors" },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    e.style.backgroundColor = node.backgroundColor;
    if (node.backgroundImage !== undefined && node.backgroundImage !== "") {
      e.style.backgroundImage = `url("${node.backgroundImage}")`;
      e.style.backgroundSize = "cover";
      e.style.backgroundPosition = "center";
    }
    e.style.height = `${node.height}px`;
    e.style.display = "flex";
    e.style.flexDirection = "column";
    e.style.justifyContent = "center";
    const a = align(node.style);
    e.style.alignItems = a === "left" ? "flex-start" : a === "right" ? "flex-end" : "center";
    e.style.textAlign = a;
    if (node.textColor !== undefined) e.style.color = node.textColor;

    const h = ctx.doc.createElement("h2");
    h.textContent = node.heading;
    h.style.margin = "0";
    e.append(h);

    if (node.subtext !== undefined && node.subtext !== "") {
      const p = ctx.doc.createElement("p");
      p.textContent = node.subtext;
      p.style.margin = "8px 0 0";
      e.append(p);
    }

    if (node.button !== undefined) {
      const href = normalizeHref(node.button.href);
      const btn = ctx.doc.createElement(href !== null ? "a" : "span");
      if (href !== null) btn.setAttribute("href", href);
      btn.textContent = node.button.label;
      btn.style.display = "inline-block";
      btn.style.marginTop = "16px";
      e.append(btn);
    }
    return e;
  },
  renderExport: (node) => {
    const attrs: Record<string, string> = {
      mode: "fixed-height",
      height: `${node.height}px`,
      "background-color": node.backgroundColor,
    };
    if (node.backgroundImage !== undefined && node.backgroundImage !== "") {
      attrs["background-url"] = node.backgroundImage;
    }
    const a = align(node.style);
    const colorStyle = node.textColor !== undefined ? ` color="${escapeAttr(node.textColor)}"` : "";
    const sub =
      node.subtext !== undefined && node.subtext !== ""
        ? `<mj-text align="${a}"${colorStyle} padding-top="8px">${escapeHtml(node.subtext)}</mj-text>`
        : "";
    let button = "";
    if (node.button !== undefined) {
      const href = normalizeHref(node.button.href);
      if (href !== null) {
        button = `<mj-button href="${escapeAttr(href)}" align="${a}">${escapeHtml(node.button.label)}</mj-button>`;
      }
    }
    const heading = `<mj-text align="${a}"${colorStyle} font-size="28px" font-weight="bold">${escapeHtml(node.heading)}</mj-text>`;
    return {
      mjml: `<mj-hero${attrsToString(attrs)}>${heading}${sub}${button}</mj-hero>`,
    };
  },
};
