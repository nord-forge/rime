// Pure node -> preview DOM mappers for editing/hit-testing (divs + flexbox), NOT
// the email export HTML. Every element is stamped with its node id + type so a
// pointer can resolve to a node.

import type {
  BaseNode,
  BlockStyle,
  ButtonBlock,
  ColumnNode,
  DividerBlock,
  DocumentNode,
  ImageBlock,
  Inline,
  RichTextJSON,
  SectionNode,
  SpacerBlock,
  TextBlock,
} from "@nord-forge/rime-model";

/** Create an element stamped with the node's identity for hit-testing. */
export function el(doc: Document, node: BaseNode, tag = "div"): HTMLElement {
  const e = doc.createElement(tag);
  e.dataset["nodeId"] = node.id;
  e.dataset["nodeType"] = node.type;
  return e;
}

/** Apply BlockStyle (padding/background/align) as inline styles. Idempotent. */
export function applyStyle(e: HTMLElement, style: BlockStyle | undefined): void {
  // Reset the props we manage so re-application doesn't leave stale values.
  e.style.paddingTop = style?.paddingTop !== undefined ? `${style.paddingTop}px` : "";
  e.style.paddingRight = style?.paddingRight !== undefined ? `${style.paddingRight}px` : "";
  e.style.paddingBottom = style?.paddingBottom !== undefined ? `${style.paddingBottom}px` : "";
  e.style.paddingLeft = style?.paddingLeft !== undefined ? `${style.paddingLeft}px` : "";
  e.style.backgroundColor = style?.backgroundColor ?? "";
  e.style.textAlign = style?.align ?? "";
}

/** Paint a merge tag as an atomic, themed chip (visual parity with the editor). */
export function renderTokenChip(
  token: string,
  label: string | undefined,
  doc: Document,
): HTMLElement {
  const chip = doc.createElement("span");
  chip.dataset["token"] = token;
  chip.setAttribute("contenteditable", "false");
  chip.textContent = label ?? token;
  chip.style.display = "inline-block";
  chip.style.padding = "0 4px";
  chip.style.borderRadius = "3px";
  chip.style.background = "var(--rime-token-bg, var(--rime-accent-soft, #e8eefc))";
  chip.style.color = "var(--rime-token-fg, var(--rime-accent, #2748b8))";
  chip.style.fontSize = "0.9em";
  chip.style.whiteSpace = "nowrap";
  return chip;
}

function appendRuns(host: HTMLElement, runs: Inline[] | undefined, doc: Document): void {
  for (const run of runs ?? []) {
    if (run.type === "token") {
      host.append(renderTokenChip(run.token, run.label, doc));
      continue;
    }
    let child: Node = doc.createTextNode(run.text);
    for (const mark of ["bold", "italic", "underline"] as const) {
      if (run.marks?.includes(mark)) {
        const tag = mark === "bold" ? "strong" : mark === "italic" ? "em" : "u";
        const wrapper = doc.createElement(tag);
        wrapper.append(child);
        child = wrapper;
      }
    }
    if (run.link !== undefined) {
      const a = doc.createElement("a");
      a.href = run.link;
      a.append(child);
      child = a;
    }
    host.append(child);
  }
}

export function renderRichText(content: RichTextJSON, doc: Document): DocumentFragment {
  const frag = doc.createDocumentFragment();
  for (const block of content.content) {
    if (block.type === "heading") {
      const h = doc.createElement(`h${block.level}`);
      h.style.margin = "0";
      appendRuns(h, block.content, doc);
      frag.append(h);
    } else if (block.type === "list") {
      const list = doc.createElement(block.ordered ? "ol" : "ul");
      list.style.margin = "0";
      for (const item of block.items) {
        const li = doc.createElement("li");
        appendRuns(li, item.content, doc);
        list.append(li);
      }
      frag.append(list);
    } else {
      const p = doc.createElement("p");
      p.style.margin = "0";
      appendRuns(p, block.content, doc);
      frag.append(p);
    }
  }
  return frag;
}

export function renderDocument(node: DocumentNode, doc: Document): HTMLElement {
  const e = el(doc, node);
  e.style.maxWidth = `${node.settings.contentWidth}px`;
  e.style.margin = "0 auto";
  e.style.backgroundColor = node.settings.backgroundColor;
  e.style.fontFamily = node.settings.fontFamily;
  return e;
}

export function renderSection(node: SectionNode, doc: Document): HTMLElement {
  const e = el(doc, node);
  e.style.display = "block";
  applyStyle(e, node.style);
  // The column row is a flex container.
  e.style.setProperty("--rime-section", "1");
  const row = doc.createElement("div");
  row.dataset["nodeRole"] = "column-row";
  row.style.display = "flex";
  row.style.flexDirection = "row";
  e.append(row);
  return e;
}

export function renderColumn(node: ColumnNode, doc: Document): HTMLElement {
  const e = el(doc, node);
  e.style.flexBasis = `${node.widthPercent}%`;
  e.style.flexGrow = "0";
  e.style.flexShrink = "0";
  e.style.maxWidth = `${node.widthPercent}%`;
  applyStyle(e, node.style);
  return e;
}

export function renderText(node: TextBlock, doc: Document): HTMLElement {
  const e = el(doc, node);
  applyStyle(e, node.style);
  e.append(renderRichText(node.content, doc));
  return e;
}

export function renderImage(node: ImageBlock, doc: Document): HTMLElement {
  const e = el(doc, node);
  applyStyle(e, node.style);
  const img = doc.createElement("img");
  img.src = node.src;
  img.alt = node.alt;
  img.style.maxWidth = "100%";
  if (node.href !== undefined) {
    const a = doc.createElement("a");
    a.href = node.href;
    a.append(img);
    e.append(a);
  } else {
    e.append(img);
  }
  return e;
}

export function renderButton(node: ButtonBlock, doc: Document): HTMLElement {
  const e = el(doc, node);
  applyStyle(e, node.style);
  const a = doc.createElement("a");
  a.href = node.href;
  a.textContent = node.label;
  a.style.display = "inline-block";
  a.style.textDecoration = "none";
  e.append(a);
  return e;
}

export function renderDivider(node: DividerBlock, doc: Document): HTMLElement {
  const e = el(doc, node);
  applyStyle(e, node.style);
  const hr = doc.createElement("hr");
  hr.style.border = "0";
  hr.style.borderTop = "1px solid currentColor";
  hr.style.margin = "0";
  e.append(hr);
  return e;
}

export function renderSpacer(node: SpacerBlock, doc: Document): HTMLElement {
  const e = el(doc, node);
  e.style.height = `${node.height}px`;
  return e;
}

/** Inert placeholder for an unknown node type (never throw, never blank canvas). */
export function renderUnknown(node: BaseNode, doc: Document): HTMLElement {
  const e = el(doc, node);
  e.dataset["nodeUnknown"] = "1";
  e.style.display = "none";
  return e;
}
