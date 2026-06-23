// The Enveloppe document model — ONE immutable JSON tree, the single source of
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

/** Root node: global email settings + ordered sections. */
export interface DocumentNode extends BaseNode {
  type: "document";
  settings: DocumentSettings;
  children: SectionNode[];
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

/** Any node in the tree. */
export type AnyNode = DocumentNode | SectionNode | ColumnNode | LeafBlock;

/** The top-level document type consumers load/save. */
export type EnveloppeDoc = DocumentNode;

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
