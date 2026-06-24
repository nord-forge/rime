// Convert RichTextJSON into escaped inline HTML for <mj-text>. No DOM, no engine.

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
