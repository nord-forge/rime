// Portable, engine-independent rich-text representation.
//
// The doc model NEVER imports Lexical (or any editor engine). Text content is
// stored in this normalized JSON shape; @nord-forge/rime-core's Lexical adapter
// converts to/from it. Mirrors the shape proven in the rich-text engine spike.

/** Inline formatting marks supported in v1. */
export type Mark = "bold" | "italic" | "underline";

/** A run of text sharing the same marks (and optional link). */
export interface TextRun {
  type: "text";
  text: string;
  /** Inline marks applied to this run. Omitted when empty. */
  marks?: Mark[];
  /** Link href, when this run is a link. */
  link?: string;
}

/** A block-level paragraph of inline runs. */
export interface Paragraph {
  type: "paragraph";
  content?: TextRun[];
}

/** Normalized rich-text document stored on a TextBlock. */
export interface RichTextJSON {
  type: "doc";
  content: Paragraph[];
}

/** An empty rich-text doc (a single empty paragraph). */
export function emptyRichText(): RichTextJSON {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}
