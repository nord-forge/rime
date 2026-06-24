// Portable, engine-independent rich-text shape. The doc model never imports an
// editor engine; the core's Lexical adapter converts to/from this.

export type Mark = "bold" | "italic" | "underline";

export interface TextRun {
  type: "text";
  text: string;
  marks?: Mark[];
  link?: string;
}

export interface Paragraph {
  type: "paragraph";
  content?: TextRun[];
}

export type HeadingLevel = 1 | 2 | 3;

export interface Heading {
  type: "heading";
  level: HeadingLevel;
  content?: TextRun[];
}

export interface ListItem {
  type: "listitem";
  content?: TextRun[];
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
