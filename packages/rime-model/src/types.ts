// The Rime document model — ONE immutable JSON tree, the single source of
// truth rendered by the canvas, exported by the MJML renderer, and diffed by
// undo/redo. Pure data: every field is serializable (no functions, no DOM).

import type { RichTextJSON } from "./rich-text";

/** Stable, unique identifier present on every node. */
export type NodeId = string;

/** Horizontal alignment shared by several blocks. */
export type Align = "left" | "center" | "right";

/**
 * Visual style shared by block-level nodes. All fields optional and
 * serializable; renderers supply sensible defaults for anything omitted.
 */
export interface BlockStyle {
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  backgroundColor?: string;
  align?: Align;
}

/** Common shape of every node in the tree. */
export interface BaseNode {
  id: NodeId;
  type: string;
}

/** Root node: global email settings + ordered sections (and section-level bands). */
export interface DocumentNode extends BaseNode {
  type: "document";
  settings: DocumentSettings;
  children: DocumentChild[];
}

/**
 * A document-level node that is NOT a section: a full-bleed "band" that lives
 * beside sections (e.g. a hero). The model is headless and does not know the
 * concrete band types — registered blocks declare `placement: "section"` and the
 * validator accepts them via `extraSectionTypes`. Only the common shape (id +
 * optional BlockStyle) is modelled here; the block's own schema validates the rest.
 */
export interface BandBlock extends BaseNode {
  style?: BlockStyle;
}

/** A direct child of the document: a section or a section-level band block. */
export type DocumentChild = SectionNode | BandBlock;

/**
 * Narrow a document child to a SectionNode. A plain `child.type === "section"`
 * check does NOT narrow, because BandBlock's `type` is the open `string` and so
 * overlaps "section" structurally — use this guard instead.
 */
export function isSection(child: DocumentChild): child is SectionNode {
  return child.type === "section";
}

/** Global, document-wide settings. Kept small for v1. */
export interface DocumentSettings {
  /** Content column width in px (the email body width). */
  contentWidth: number;
  /** Page background colour (CSS colour string). */
  backgroundColor: string;
  /** Default font stack. */
  fontFamily: string;
}

/** A full-width horizontal band containing one or more columns. */
export interface SectionNode extends BaseNode {
  type: "section";
  style: BlockStyle;
  children: ColumnNode[];
}

/** A vertical column inside a section; widths in a section sum to ~100. */
export interface ColumnNode extends BaseNode {
  type: "column";
  /** Percentage of the section width (siblings sum to ~100). */
  widthPercent: number;
  style: BlockStyle;
  children: LeafBlock[];
}

/** Rich-text block. Content stored as portable, engine-independent JSON. */
export interface TextBlock extends BaseNode {
  type: "text";
  content: RichTextJSON;
  style: BlockStyle;
}

/** Image block; optional `href` makes the image a link. */
export interface ImageBlock extends BaseNode {
  type: "image";
  src: string;
  alt: string;
  href?: string;
  style: BlockStyle;
}

/** Call-to-action button. */
export interface ButtonBlock extends BaseNode {
  type: "button";
  label: string;
  href: string;
  style: BlockStyle;
}

/** Horizontal rule. */
export interface DividerBlock extends BaseNode {
  type: "divider";
  style: BlockStyle;
}

/** Vertical whitespace of a fixed height (px). */
export interface SpacerBlock extends BaseNode {
  type: "spacer";
  height: number;
}

/** Any leaf (content) block that can live inside a column. */
export type LeafBlock = TextBlock | ImageBlock | ButtonBlock | DividerBlock | SpacerBlock;

/**
 * Any built-in node in the tree, as a CLOSED discriminated union so `node.type`
 * narrows cleanly. Section-level band blocks (BandBlock) are intentionally NOT
 * members — their open `type: string` would defeat narrowing across this union.
 * Generic tree-walkers read `.children` structurally and so handle bands anyway;
 * `DocumentChild` is the precise type for a document's direct children.
 */
export type AnyNode = DocumentNode | SectionNode | ColumnNode | LeafBlock;

/** The top-level document type consumers load/save. */
export type RimeDoc = DocumentNode;

/** All recognised node `type` discriminators. */
export const NODE_TYPES = [
  "document",
  "section",
  "column",
  "text",
  "image",
  "button",
  "divider",
  "spacer",
] as const;

/** Leaf block `type` discriminators (legal children of a column). */
export const LEAF_TYPES = ["text", "image", "button", "divider", "spacer"] as const;

export type NodeType = (typeof NODE_TYPES)[number];
export type LeafType = (typeof LEAF_TYPES)[number];
