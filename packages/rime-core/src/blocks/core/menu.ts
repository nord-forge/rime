import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { ICON_MENU } from "../../palette/icons";
import { applyStyle, el } from "../../canvas/render-node/render-node";
import {
  attrsToString,
  escapeAttr,
  escapeHtml,
  normalizeHref,
  styleToMjmlAttrs,
} from "./mjml-attrs";

export interface MenuItem {
  label: string;
  href: string;
}

export interface MenuBlock extends BaseNode {
  type: "menu";
  items: MenuItem[];
  // Horizontal for v1 — a select with room to grow (vertical/stacked later).
  layout: "horizontal";
  color?: string;
  style: BlockStyle;
}

export const menuBlock: BlockDefinition<MenuBlock> = {
  type: "menu",
  palette: {
    label: "Menu",
    icon: ICON_MENU,
    category: "Content",
    defaults: {
      items: [
        { label: "Home", href: "#" },
        { label: "About", href: "#" },
      ],
      layout: "horizontal",
      style: {},
    },
  },
  schema: {
    fields: [
      {
        key: "items",
        label: "Links",
        type: "list",
        group: "Content",
        itemFields: [
          { key: "label", label: "Label", type: "text" },
          { key: "href", label: "URL", type: "url" },
        ],
      },
      {
        key: "layout",
        label: "Layout",
        type: "select",
        group: "Layout",
        options: [{ value: "horizontal", label: "Horizontal" }],
      },
      { key: "color", label: "Color", type: "color", group: "Colors" },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    const nav = ctx.doc.createElement("nav");
    nav.style.display = "flex";
    nav.style.flexDirection = "row";
    nav.style.gap = "16px";
    nav.style.justifyContent =
      node.style.align === "center"
        ? "center"
        : node.style.align === "right"
          ? "flex-end"
          : "flex-start";
    for (const item of node.items) {
      const href = normalizeHref(item.href);
      const a = ctx.doc.createElement("a");
      if (href !== null) a.setAttribute("href", href);
      if (node.color !== undefined) a.style.color = node.color;
      a.textContent = item.label;
      nav.append(a);
    }
    e.append(nav);
    return e;
  },
  renderExport: (node) => {
    const attrs = styleToMjmlAttrs(node.style);
    const links = node.items
      .map((item) => {
        const href = normalizeHref(item.href);
        if (href === null) return "";
        const colorAttr = node.color !== undefined ? ` color="${escapeAttr(node.color)}"` : "";
        return `<mj-navbar-link href="${escapeAttr(href)}"${colorAttr}>${escapeHtml(item.label)}</mj-navbar-link>`;
      })
      .join("");
    return { mjml: `<mj-navbar${attrsToString(attrs)}>${links}</mj-navbar>` };
  },
};
