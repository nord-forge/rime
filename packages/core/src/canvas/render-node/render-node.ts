// Pure node → preview DOM mappers (the WYSIWYG, PRD §6.2). This is NOT the email
// export HTML: it renders modern, edit-friendly markup (divs + flexbox) optimized
// for editing and hit-testing. Ghost-table/mso email HTML is produced separately
// at export time. Every element is stamped with its node id + type so hit-testing
// and selection can resolve a pointer → node.

import type {
  BaseNode,
  BlockStyle,
  ButtonBlock,
  ColumnNode,
  DividerBlock,
  DocumentNode,
  ImageBlock,
  RichTextJSON,
  SectionNode,
  SpacerBlock,
  TextBlock,
} from "@enveloppe/doc-model";

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

/** Render the portable RichTextJSON into preview DOM (static; no editor engine). */
export function renderRichText(content: RichTextJSON, doc: Document): DocumentFragment {
  const frag = doc.createDocumentFragment();
  for (const paragraph of content.content) {
    const p = doc.createElement("p");
    p.style.margin = "0";
    for (const run of paragraph.content ?? []) {
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
      p.append(child);
    }
    frag.append(p);
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
  e.style.setProperty("--eb-section", "1");
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
