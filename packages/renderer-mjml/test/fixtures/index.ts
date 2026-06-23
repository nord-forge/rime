// Golden fixture docs — the single source of truth shared by the snapshot test
// and the render:fixtures script. Each uses a deterministic id factory so the
// rendered HTML is stable run-to-run (snapshot-friendly). All are validateDoc-valid.

import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
  type IdFactory,
  type RichTextJSON,
} from "@enveloppe/doc-model";

/** Deterministic id factory: `<prefix>_<n>`, no randomness. */
function seq(): IdFactory {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

const richText = (runs: RichTextJSON["content"][number]["content"]): RichTextJSON => ({
  type: "doc",
  content: [{ type: "paragraph", content: runs }],
});

/** One section/column/text with mixed marks + a link (rich-text path). */
function singleText(): DocumentNode {
  const id = seq();
  const doc = createEmptyDoc(id);
  const section = createSection(id, 1);
  section.children[0]!.children.push(
    createTextBlock(
      id,
      richText([
        { type: "text", text: "Hello " },
        { type: "text", text: "bold", marks: ["bold"] },
        { type: "text", text: " and " },
        { type: "text", text: "linked", link: "https://example.test", marks: ["underline"] },
        { type: "text", text: "." },
      ]),
    ),
  );
  doc.children.push(section);
  return doc;
}

/** A button — the classic Outlook VML / ghost-table risk. */
function button(): DocumentNode {
  const id = seq();
  const doc = createEmptyDoc(id);
  const section = createSection(id, 1);
  const btn = createButtonBlock(id, "Shop now", "https://example.test/shop");
  btn.style = { paddingTop: 12, paddingBottom: 12, align: "center", backgroundColor: "#5b5bd6" };
  section.children[0]!.children.push(btn);
  doc.children.push(section);
  return doc;
}

/** A section with two 50% columns (stacking on mobile / Outlook). */
function twoColumn(): DocumentNode {
  const id = seq();
  const doc = createEmptyDoc(id);
  const section = createSection(id, 2);
  section.children[0]!.children.push(
    createTextBlock(id, richText([{ type: "text", text: "Left" }])),
  );
  section.children[1]!.children.push(
    createTextBlock(id, richText([{ type: "text", text: "Right" }])),
  );
  doc.children.push(section);
  return doc;
}

/** Image with href, divider, spacer (spacing + image fidelity). */
function imageDividerSpacer(): DocumentNode {
  const id = seq();
  const doc = createEmptyDoc(id);
  const section = createSection(id, 1);
  const col = section.children[0]!;
  col.children.push(
    {
      id: id("image"),
      type: "image",
      src: "https://example.test/logo.png",
      alt: "Logo",
      href: "https://example.test",
      style: { align: "center" },
    },
    { id: id("divider"), type: "divider", style: { paddingTop: 8, paddingBottom: 8 } },
    { id: id("spacer"), type: "spacer", height: 32 },
  );
  doc.children.push(section);
  return doc;
}

/** A realistic multi-section newsletter combining all core blocks. */
function fullNewsletter(): DocumentNode {
  const id = seq();
  const doc = createEmptyDoc(id);

  const header = createSection(id, 1);
  header.children[0]!.children.push({
    id: id("image"),
    type: "image",
    src: "https://example.test/banner.png",
    alt: "Banner",
    style: {},
  });

  const intro = createSection(id, 1);
  intro.children[0]!.children.push(
    createTextBlock(
      id,
      richText([
        { type: "text", text: "Welcome to our " },
        { type: "text", text: "newsletter", marks: ["bold", "italic"] },
        { type: "text", text: "!" },
      ]),
    ),
  );

  const cols = createSection(id, 2);
  cols.children[0]!.children.push(
    createTextBlock(id, richText([{ type: "text", text: "Story one" }])),
  );
  cols.children[1]!.children.push(
    createTextBlock(id, richText([{ type: "text", text: "Story two" }])),
  );

  const cta = createSection(id, 1);
  cta.children[0]!.children.push(
    { id: id("divider"), type: "divider", style: {} },
    { id: id("spacer"), type: "spacer", height: 16 },
    createButtonBlock(id, "Read more", "https://example.test/more"),
  );

  doc.children.push(header, intro, cols, cta);
  return doc;
}

/** All fixtures keyed by name — the single source of truth. */
export const fixtures: Record<string, DocumentNode> = {
  "single-text": singleText(),
  button: button(),
  "two-column": twoColumn(),
  "image-divider-spacer": imageDividerSpacer(),
  "full-newsletter": fullNewsletter(),
};
