// MJML attribute/escape helpers for the core blocks' renderExport. These mirror
// renderer-mjml's mapping exactly (asserted by a parity test) so the registry
// export path and the standalone renderer agree for core node types — without
// rime-core depending on rime-mjml.

import type { BlockStyle, Mark, RichTextJSON, TextRun } from "@nord-forge/rime-model";

export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
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

function renderRun(run: TextRun): string {
  let html = escapeHtml(run.text);
  for (const mark of ["bold", "italic", "underline"] as const) {
    if (run.marks?.includes(mark)) html = `<${MARK_TAGS[mark]}>${html}</${MARK_TAGS[mark]}>`;
  }
  if (run.link !== undefined) html = `<a href="${escapeAttr(run.link)}">${html}</a>`;
  return html;
}

function renderRuns(runs: TextRun[] | undefined): string {
  return (runs ?? []).map(renderRun).join("");
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
