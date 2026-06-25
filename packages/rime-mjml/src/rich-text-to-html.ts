// Convert RichTextJSON into escaped inline HTML for <mj-text>. No DOM, no engine.

import type { Inline, Mark, RichTextJSON } from "@nord-forge/rime-model";

/** Escape text for HTML element content. */
export function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

/** Escape a value for use inside a double-quoted HTML attribute. */
export function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll('"', "&quot;");
}

// Allow only http(s) and mailto; reject javascript:/data: and anything unparseable.
// Kept in parity with the standalone copy in rime-core's blocks/core/mjml-attrs.ts
// (the parity test asserts both export paths agree).
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

const MARK_TAGS: Record<Mark, string> = {
  bold: "strong",
  italic: "em",
  underline: "u",
};

function renderInline(run: Inline): string {
  // A token exports to the literal {{key}} so the ESP does the substitution; the
  // key is HTML-escaped but the braces are literal.
  if (run.type === "token") {
    return `{{${escapeHtml(run.token)}}}`;
  }

  let html = escapeHtml(run.text);

  // Wrap with mark tags (deterministic order so output is stable for snapshots).
  for (const mark of ["bold", "italic", "underline"] as const) {
    if (run.marks?.includes(mark)) {
      const tag = MARK_TAGS[mark];
      html = `<${tag}>${html}</${tag}>`;
    }
  }

  if (run.link !== undefined) {
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
