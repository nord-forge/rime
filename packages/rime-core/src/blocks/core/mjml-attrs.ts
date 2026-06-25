// MJML attribute/escape helpers for the core blocks' renderExport. These mirror
// renderer-mjml's mapping exactly (asserted by a parity test) so the registry
// export path and the standalone renderer agree for core node types — without
// rime-core depending on rime-mjml.

import type { BlockStyle, Inline, Mark, RichTextJSON } from "@nord-forge/rime-model";

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

// Allow only http(s) and mailto; reject javascript:/data: and anything unparseable.
// A standalone copy of the rich-text href guard kept here so the export path stays
// free of the Lexical-dependent richtext module.
export function normalizeHref(raw: string): string | null {
  const value = raw.trim();
  if (value === "") return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  const scheme = url.protocol.toLowerCase();
  if (scheme !== "http:" && scheme !== "https:" && scheme !== "mailto:") return null;
  return url.href;
}

export function styleToMjmlAttrs(style: BlockStyle | undefined): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!style) return attrs;
  if (style.paddingTop !== undefined) attrs["padding-top"] = `${style.paddingTop}px`;
  if (style.paddingRight !== undefined) attrs["padding-right"] = `${style.paddingRight}px`;
  if (style.paddingBottom !== undefined) attrs["padding-bottom"] = `${style.paddingBottom}px`;
  if (style.paddingLeft !== undefined) attrs["padding-left"] = `${style.paddingLeft}px`;
  if (style.backgroundColor !== undefined) attrs["background-color"] = style.backgroundColor;
  if (style.align !== undefined) attrs["align"] = style.align;
  return attrs;
}

export function attrsToString(attrs: Record<string, string>): string {
  return Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${escapeAttr(value)}"`)
    .join("");
}

const MARK_TAGS: Record<Mark, string> = { bold: "strong", italic: "em", underline: "u" };

function renderInline(run: Inline): string {
  if (run.type === "token") return `{{${escapeHtml(run.token)}}}`;
  let html = escapeHtml(run.text);
  for (const mark of ["bold", "italic", "underline"] as const) {
    if (run.marks?.includes(mark)) html = `<${MARK_TAGS[mark]}>${html}</${MARK_TAGS[mark]}>`;
  }
  if (run.link !== undefined) {
    // Drop javascript:/data:/unparseable links; render the text without an anchor.
    const href = normalizeHref(run.link);
    if (href !== null) html = `<a href="${escapeAttr(href)}">${html}</a>`;
  }
  return html;
}

function renderRuns(runs: Inline[] | undefined): string {
  return (runs ?? []).map(renderInline).join("");
}

export function richTextToInlineHtml(content: RichTextJSON): string {
  return content.content
    .map((block) => {
      if (block.type === "heading") {
        return `<h${block.level}>${renderRuns(block.content)}</h${block.level}>`;
      }
      if (block.type === "list") {
        const tag = block.ordered ? "ol" : "ul";
        const items = block.items.map((item) => `<li>${renderRuns(item.content)}</li>`).join("");
        return `<${tag}>${items}</${tag}>`;
      }
      return `<p>${renderRuns(block.content)}</p>`;
    })
    .join("");
}
