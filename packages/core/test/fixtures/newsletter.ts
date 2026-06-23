// A realistic newsletter doc: several sections, multi-column rows, dozens of leaf
// blocks — the drag-over target for the DnD perf benchmark (ENV-21) and other
// integration tests. Deterministic ids so geometry is stable.

import type { DocumentNode } from "@enveloppe/doc-model";

function text(id: string, body: string) {
  return {
    id,
    type: "text" as const,
    style: { paddingTop: 12, paddingBottom: 12 },
    content: {
      type: "doc" as const,
      content: [{ type: "paragraph" as const, content: [{ type: "text" as const, text: body }] }],
    },
  };
}

function button(id: string) {
  return {
    id,
    type: "button" as const,
    label: "CTA",
    href: "https://example.test",
    style: { paddingTop: 10, paddingBottom: 10 },
  };
}

function image(id: string) {
  return { id, type: "image" as const, src: "https://example.test/i.png", alt: "img", style: {} };
}

/** ~40 leaf blocks across 6 sections (mix of 1- and 2-column). */
export function newsletterDoc(): DocumentNode {
  const sections = [];
  let n = 0;
  const leaf = (kind: "t" | "b" | "i") => {
    const id = `${kind}_${n++}`;
    return kind === "t" ? text(id, `Paragraph ${n}`) : kind === "b" ? button(id) : image(id);
  };

  // Header (1 col, image + heading)
  sections.push({
    id: "sec_header",
    type: "section" as const,
    style: { paddingTop: 8, paddingBottom: 8 },
    children: [
      {
        id: "col_header",
        type: "column" as const,
        widthPercent: 100,
        style: {},
        children: [leaf("i"), leaf("t")],
      },
    ],
  });

  // Four 2-column body sections, ~4 leaves each column
  for (let s = 0; s < 4; s++) {
    sections.push({
      id: `sec_body_${s}`,
      type: "section" as const,
      style: { paddingTop: 8, paddingBottom: 8 },
      children: [
        {
          id: `col_${s}_l`,
          type: "column" as const,
          widthPercent: 50,
          style: {},
          children: [leaf("t"), leaf("t"), leaf("i")],
        },
        {
          id: `col_${s}_r`,
          type: "column" as const,
          widthPercent: 50,
          style: {},
          children: [leaf("t"), leaf("b"), leaf("t")],
        },
      ],
    });
  }

  // Footer (1 col)
  sections.push({
    id: "sec_footer",
    type: "section" as const,
    style: { paddingTop: 8, paddingBottom: 8 },
    children: [
      {
        id: "col_footer",
        type: "column" as const,
        widthPercent: 100,
        style: {},
        children: [leaf("t"), leaf("b")],
      },
    ],
  });

  return {
    id: "doc_news",
    type: "document",
    settings: { contentWidth: 600, backgroundColor: "#f4f4f5", fontFamily: "Arial" },
    children: sections,
  };
}
