// Convert the portable, engine-independent RichTextJSON (paragraphs → text runs
// with bold/italic/underline marks + optional link) into escaped inline HTML safe
// inside <mj-text>. Plain string building — no DOM, no rich-text engine import.

import type { Mark, RichTextJSON, TextRun } from "@nord-forge/rime-model";

/** Escape text for HTML element content. */
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Escape a value for use inside a double-quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

const MARK_TAGS: Record<Mark, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
};

function renderRun(run: TextRun): string {
  let html = escapeHtml(run.text);

  // Wrap with mark tags (deterministic order so output is stable for snapshots).
  for (const mark of ["bold", "italic", "underline"] as const) {
    if (run.marks?.includes(mark)) {
      const tag = MARK_TAGS[mark];
      html = `<${tag}>${html}</${tag}>`;
    }
  }

  if (run.link !== undefined) {
    html = `<a href="${escapeAttr(run.link)}">${html}</a>`;
  }

  return html;
}

/** Convert a RichTextJSON document to inline HTML (one <p> per paragraph). */
export function richTextToInlineHtml(content: RichTextJSON): string {
  return content.content
    .map((paragraph) => {
      const inner = (paragraph.content ?? []).map(renderRun).join("");
      return `<p>${inner}</p>`;
    })
    .join("");
}
