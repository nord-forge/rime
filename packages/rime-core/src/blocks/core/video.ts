import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { ICON_VIDEO } from "../../palette/icons";
import { applyStyle, el } from "../../canvas/render-node/render-node";
import { escapeAttr, normalizeHref } from "./mjml-attrs";

export interface VideoBlock extends BaseNode {
  type: "video";
  posterImage?: string;
  videoUrl: string;
  alt: string;
  style: BlockStyle;
}

const PLACEHOLDER_BG = "#222222";

// A circular play badge: a 48px disc with a white triangle. Inline SVG on canvas;
// the export bakes the same triangle into the raw-table overlay (no icon dep, no
// network fetch).
function playBadge(doc: Document): SVGSVGElement {
  const svg = doc.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "48");
  svg.setAttribute("height", "48");
  svg.setAttribute("viewBox", "0 0 48 48");
  svg.setAttribute("aria-hidden", "true");
  const circle = doc.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "24");
  circle.setAttribute("cy", "24");
  circle.setAttribute("r", "24");
  circle.setAttribute("fill", "rgba(0,0,0,0.6)");
  const tri = doc.createElementNS("http://www.w3.org/2000/svg", "path");
  tri.setAttribute("d", "M19 15l14 9-14 9z");
  tri.setAttribute("fill", "#ffffff");
  svg.append(circle, tri);
  return svg;
}

export const videoBlock: BlockDefinition<VideoBlock> = {
  type: "video",
  palette: {
    label: "Video",
    icon: ICON_VIDEO,
    category: "Content",
    defaults: { videoUrl: "#", alt: "Video", style: {} },
  },
  schema: {
    fields: [
      { key: "posterImage", label: "Poster image", type: "url", group: "Content" },
      { key: "videoUrl", label: "Video URL", type: "url", group: "Content" },
      { key: "alt", label: "Alt text", type: "text", group: "Content" },
      { key: "style.align", label: "Align", type: "align", group: "Layout" },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    const href = normalizeHref(node.videoUrl);
    const a = ctx.doc.createElement("a");
    if (href !== null) a.setAttribute("href", href);
    a.style.display = "inline-block";
    a.style.position = "relative";
    a.style.textDecoration = "none";

    if (node.posterImage !== undefined && node.posterImage !== "") {
      const img = ctx.doc.createElement("img");
      img.src = node.posterImage;
      img.alt = node.alt;
      img.style.display = "block";
      img.style.maxWidth = "100%";
      a.append(img);
    } else {
      // Color placeholder when no poster is set.
      const ph = ctx.doc.createElement("div");
      ph.style.background = PLACEHOLDER_BG;
      ph.style.minWidth = "240px";
      ph.style.minHeight = "135px";
      a.append(ph);
    }

    const overlay = ctx.doc.createElement("div");
    overlay.style.position = "absolute";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.right = "0";
    overlay.style.bottom = "0";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.append(playBadge(ctx.doc));
    a.append(overlay);
    e.append(a);
    return e;
  },
  // Raw-table fallback: a linked poster with a centered play badge overlaid. MJML
  // has no overlay-capable video component, so a real play graphic over the poster
  // needs the raw path (vs. <mj-image>+link, which can't composite a separate
  // badge). The play badge is a data-URI SVG layered over the poster image.
  renderExport: (node) => {
    const href = normalizeHref(node.videoUrl);
    const alt = escapeAttr(node.alt);
    const poster =
      node.posterImage !== undefined && node.posterImage !== ""
        ? `<img src="${escapeAttr(node.posterImage)}" alt="${alt}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0" />`
        : `<div style="background:${PLACEHOLDER_BG};height:300px"></div>`;
    const badge =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">' +
          '<circle cx="24" cy="24" r="24" fill="rgba(0,0,0,0.6)"/>' +
          '<path d="M19 15l14 9-14 9z" fill="#ffffff"/></svg>',
      );
    // Centered overlay via a single-cell table whose background is the poster and
    // whose content is the play badge — broadly email-client safe.
    const inner =
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:0 auto">` +
      `<tr><td align="center" valign="middle" background="${escapeAttr(node.posterImage ?? "")}" style="text-align:center">` +
      poster +
      `<div style="margin-top:-84px;margin-bottom:36px"><img src="${badge}" width="48" height="48" alt="Play" style="display:inline-block;border:0" /></div>` +
      `</td></tr></table>`;
    const linked =
      href !== null
        ? `<a href="${escapeAttr(href)}" style="text-decoration:none">${inner}</a>`
        : inner;
    return { raw: `<mj-raw>${linked}</mj-raw>` };
  },
};
