// Portable, engine-independent rich-text shape. The doc model never imports an
// editor engine; the core's Lexical adapter converts to/from this.

export type Mark = "bold" | "italic" | "underline";

export interface TextRun {
  type: "text";
  text: string;
  marks?: Mark[];
  link?: string;
}

// An inline merge tag, e.g. {{first_name}}. The bare key is stored (no braces);
// braces are a render concern. `label` is an optional display name for the chip.
export interface TokenInline {
  type: "token";
  token: string;
  label?: string;
}

// What can appear inline within a paragraph/heading/list item.
export type Inline = TextRun | TokenInline;

export interface Paragraph {
  type: "paragraph";
  content?: Inline[];
}

export type HeadingLevel = 1 | 2 | 3;

export interface Heading {
  type: "heading";
  level: HeadingLevel;
  content?: Inline[];
}

export interface ListItem {
  type: "listitem";
  content?: Inline[];
}

export interface List {
  type: "list";
  ordered: boolean; // true = numbered, false = bulleted
  items: ListItem[];
}

export type RichTextBlock = Paragraph | Heading | List;

export interface RichTextJSON {
  type: "doc";
  content: RichTextBlock[];
}

export function emptyRichText(): RichTextJSON {
  return { type: "doc", content: [{ type: "paragraph", content: [] }] };
}
