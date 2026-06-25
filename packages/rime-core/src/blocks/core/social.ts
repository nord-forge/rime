import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { ICON_SOCIAL } from "../../palette/icons";
import { applyStyle, el } from "../../canvas/render-node/render-node";
import { attrsToString, escapeAttr, normalizeHref, styleToMjmlAttrs } from "./mjml-attrs";

// The built-in networks. `name` is the value MJML's <mj-social-element> understands
// for its bundled icon; `icon` is an inline SVG path drawn on the canvas (offline,
// no network fetch, no icon-library runtime dependency).
export const SOCIAL_NETWORKS = [
  "twitter",
  "facebook",
  "instagram",
  "linkedin",
  "youtube",
  "github",
] as const;

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number];

export interface SocialLink {
  network: string;
  href: string;
}

export interface SocialBlock extends BaseNode {
  type: "social";
  links: SocialLink[];
  iconSize?: number;
  style: BlockStyle;
}

const DEFAULT_ICON_SIZE = 24;

function isKnownNetwork(network: string): network is SocialNetwork {
  return (SOCIAL_NETWORKS as readonly string[]).includes(network);
}

// 24×24 single-path glyphs (viewBox 0 0 24 24). Unknown networks fall back to a
// generic globe so a stray network value still paints and exports as "web".
const ICON_PATHS: Record<SocialNetwork | "web", string> = {
  twitter:
    "M18.9 1.2h3.7l-8 9.1 9.4 12.5h-7.4l-5.8-7.6-6.6 7.6H.5l8.6-9.8L0 1.2h7.6l5.2 6.9zm-1.3 19.5h2L6.5 3.3H4.3z",
  facebook:
    "M22 12a10 10 0 1 0-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0 0 22 12z",
  instagram:
    "M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.3 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.3 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.3-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.3-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.1A6.7 6.7 0 1 0 18.7 12 6.7 6.7 0 0 0 12 5.3zm0 11A4.3 4.3 0 1 1 16.3 12 4.3 4.3 0 0 1 12 16.3zm6.9-11.4a1.6 1.6 0 1 1-1.6-1.6 1.6 1.6 0 0 1 1.6 1.6z",
  linkedin:
    "M20.5 2h-17A1.5 1.5 0 0 0 2 3.5v17A1.5 1.5 0 0 0 3.5 22h17a1.5 1.5 0 0 0 1.5-1.5v-17A1.5 1.5 0 0 0 20.5 2zM8 19H5V9h3zM6.5 7.7a1.8 1.8 0 1 1 1.8-1.8 1.8 1.8 0 0 1-1.8 1.8zM19 19h-3v-5c0-1.2 0-2.7-1.7-2.7s-1.9 1.3-1.9 2.6V19h-3V9h2.9v1.4h.1A3.2 3.2 0 0 1 14.2 9c3 0 3.6 2 3.6 4.6z",
  youtube:
    "M23.5 6.5a3 3 0 0 0-2.1-2.1C19.5 4 12 4 12 4s-7.5 0-9.4.4A3 3 0 0 0 .5 6.5 31 31 0 0 0 0 12a31 31 0 0 0 .5 5.5 3 3 0 0 0 2.1 2.1C4.5 20 12 20 12 20s7.5 0 9.4-.4a3 3 0 0 0 2.1-2.1A31 31 0 0 0 24 12a31 31 0 0 0-.5-5.5zM9.6 15.5v-7l6.3 3.5z",
  github:
    "M12 2A10 10 0 0 0 8.8 21.5c.5.1.7-.2.7-.5v-1.7c-2.8.6-3.4-1.3-3.4-1.3-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.5 1 1.5 1 .9 1.5 2.4 1.1 3 .8.1-.6.3-1.1.6-1.4-2.2-.2-4.6-1.1-4.6-5a3.9 3.9 0 0 1 1-2.7 3.6 3.6 0 0 1 .1-2.6s.8-.3 2.7 1a9.3 9.3 0 0 1 4.9 0c1.9-1.3 2.7-1 2.7-1a3.6 3.6 0 0 1 .1 2.6 3.9 3.9 0 0 1 1 2.7c0 3.9-2.4 4.8-4.6 5 .3.3.6.9.6 1.8v2.7c0 .3.2.6.7.5A10 10 0 0 0 12 2z",
  web: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm6.9 6h-3a15 15 0 0 0-1.3-3.4A8 8 0 0 1 18.9 8zM12 4c.8 1.2 1.5 2.6 1.9 4h-3.8c.4-1.4 1.1-2.8 1.9-4zM4.3 14a8 8 0 0 1 0-4h3.4a16 16 0 0 0 0 4zm.8 2h3a15 15 0 0 0 1.3 3.4A8 8 0 0 1 5.1 16zm3-8h-3a8 8 0 0 1 4.3-3.4A15 15 0 0 0 8.1 8zM12 20c-.8-1.2-1.5-2.6-1.9-4h3.8c-.4 1.4-1.1 2.8-1.9 4zm2.3-6H9.7a14 14 0 0 1 0-4h4.6a14 14 0 0 1 0 4zm.3 5.4A15 15 0 0 0 15.9 16h3a8 8 0 0 1-4.3 3.4zM16.3 14a16 16 0 0 0 0-4h3.4a8 8 0 0 1 0 4z",
};

function iconSvg(doc: Document, network: string, size: number): SVGSVGElement {
  const key = isKnownNetwork(network) ? network : "web";
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "currentColor");
  svg.setAttribute("aria-hidden", "true");
  const path = doc.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", ICON_PATHS[key]);
  svg.append(path);
  return svg;
}

export const socialBlock: BlockDefinition<SocialBlock> = {
  type: "social",
  palette: {
    label: "Social",
    icon: ICON_SOCIAL,
    category: "Content",
    defaults: {
      links: [
        { network: "twitter", href: "https://twitter.com" },
        { network: "instagram", href: "https://instagram.com" },
      ],
      style: {},
    },
  },
  schema: {
    fields: [
      {
        key: "links",
        label: "Links",
        type: "list",
        group: "Content",
        itemFields: [
          {
            key: "network",
            label: "Network",
            type: "select",
            options: SOCIAL_NETWORKS.map((n) => ({ value: n, label: n })),
          },
          { key: "href", label: "URL", type: "url" },
        ],
      },
      {
        key: "iconSize",
        label: "Icon size",
        type: "number",
        group: "Layout",
        min: 12,
        max: 64,
        step: 1,
      },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    const size = node.iconSize ?? DEFAULT_ICON_SIZE;
    const row = ctx.doc.createElement("div");
    row.style.display = "flex";
    row.style.gap = "12px";
    row.style.justifyContent =
      node.style.align === "center"
        ? "center"
        : node.style.align === "right"
          ? "flex-end"
          : "flex-start";
    for (const link of node.links) {
      const href = normalizeHref(link.href);
      const a = ctx.doc.createElement("a");
      if (href !== null) a.setAttribute("href", href);
      a.style.color = "inherit";
      a.style.display = "inline-flex";
      a.append(iconSvg(ctx.doc, link.network, size));
      row.append(a);
    }
    e.append(row);
    return e;
  },
  renderExport: (node) => {
    const attrs = styleToMjmlAttrs(node.style);
    attrs["mode"] = "horizontal";
    attrs["icon-size"] = `${node.iconSize ?? DEFAULT_ICON_SIZE}px`;
    const elements = node.links
      .map((link) => {
        const href = normalizeHref(link.href);
        if (href === null) return "";
        const name = isKnownNetwork(link.network) ? link.network : "web";
        return `<mj-social-element name="${escapeAttr(name)}" href="${escapeAttr(href)}" />`;
      })
      .join("");
    return { mjml: `<mj-social${attrsToString(attrs)}>${elements}</mj-social>` };
  },
};
