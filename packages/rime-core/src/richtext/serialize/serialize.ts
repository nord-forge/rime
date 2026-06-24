// Converts between the portable RichTextJSON and a live Lexical editor state.
// $applyRichTextJSON runs inside a discrete editor update; $readRichTextJSON
// inside a state read. The round-trip is lossless up to canonicalize().

import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $isElementNode,
  $isTextNode,
  type ElementNode,
  type LexicalNode,
  type TextFormatType,
} from "lexical";
import { $createHeadingNode, $isHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { $createListItemNode, $createListNode, $isListItemNode, $isListNode } from "@lexical/list";
import { $createLinkNode, $isLinkNode } from "@lexical/link";
import type {
  HeadingLevel,
  ListItem,
  Mark,
  Paragraph,
  RichTextBlock,
  RichTextJSON,
  TextRun,
} from "@nord-forge/rime-model";

const MARK_ORDER: readonly Mark[] = ["bold", "italic", "underline"] as const;

function sameRunStyle(a: TextRun, b: TextRun): boolean {
  if (a.link !== b.link) return false;
  const am = a.marks ?? [];
  const bm = b.marks ?? [];
  if (am.length !== bm.length) return false;
  return am.every((m) => bm.includes(m));
}

function canonicalRuns(runs: TextRun[] | undefined): TextRun[] {
  const out: TextRun[] = [];
  for (const run of runs ?? []) {
    if (run.text === "") continue;
    const marks = MARK_ORDER.filter((m) => run.marks?.includes(m));
    const norm: TextRun = { type: "text", text: run.text };
    if (marks.length > 0) norm.marks = marks;
    if (run.link !== undefined) norm.link = run.link;
    const prev = out[out.length - 1];
    if (prev && sameRunStyle(prev, norm)) {
      prev.text += norm.text;
    } else {
      out.push(norm);
    }
  }
  return out;
}

export function richTextEqual(a: RichTextJSON, b: RichTextJSON): boolean {
  return JSON.stringify(canonicalize(a)) === JSON.stringify(canonicalize(b));
}

export function canonicalize(json: RichTextJSON): RichTextJSON {
  return {
    type: "doc",
    content: json.content.map((block): RichTextBlock => {
      if (block.type === "heading") {
        return { type: "heading", level: block.level, content: canonicalRuns(block.content) };
      }
      if (block.type === "list") {
        return {
          type: "list",
          ordered: block.ordered,
          items: block.items.map(
            (item): ListItem => ({
              type: "listitem",
              content: canonicalRuns(item.content),
            }),
          ),
        };
      }
      return { type: "paragraph", content: canonicalRuns(block.content) };
    }),
  };
}

function headingTag(level: HeadingLevel): HeadingTagType {
  return `h${level}` as HeadingTagType;
}

function appendRuns(parent: ElementNode, runs: TextRun[] | undefined): void {
  let i = 0;
  const list = runs ?? [];
  while (i < list.length) {
    const run = list[i]!;
    if (run.link !== undefined) {
      // Adjacent runs sharing a link become one LinkNode wrapping their text.
      const link = $createLinkNode(run.link);
      while (i < list.length && list[i]!.link === run.link) {
        link.append(makeTextNode(list[i]!));
        i += 1;
      }
      parent.append(link);
    } else {
      parent.append(makeTextNode(run));
      i += 1;
    }
  }
}

function makeTextNode(run: TextRun) {
  const node = $createTextNode(run.text);
  for (const mark of run.marks ?? []) node.toggleFormat(mark as TextFormatType);
  return node;
}

export function $applyRichTextJSON(json: RichTextJSON): void {
  const root = $getRoot();
  root.clear();
  for (const block of json.content) {
    if (block.type === "heading") {
      const h = $createHeadingNode(headingTag(block.level));
      appendRuns(h, block.content);
      root.append(h);
    } else if (block.type === "list") {
      const listNode = $createListNode(block.ordered ? "number" : "bullet");
      for (const item of block.items) {
        const li = $createListItemNode();
        appendRuns(li, item.content);
        listNode.append(li);
      }
      root.append(listNode);
    } else {
      const p = $createParagraphNode();
      appendRuns(p, block.content);
      root.append(p);
    }
  }
}

function readRuns(parent: ElementNode): TextRun[] {
  const runs: TextRun[] = [];
  for (const child of parent.getChildren()) {
    collectRuns(child, undefined, runs);
  }
  return canonicalRuns(runs);
}

function collectRuns(node: LexicalNode, link: string | undefined, out: TextRun[]): void {
  if ($isLinkNode(node)) {
    const href = node.getURL();
    for (const child of node.getChildren()) collectRuns(child, href, out);
    return;
  }
  if ($isTextNode(node)) {
    const marks = MARK_ORDER.filter((m) => node.hasFormat(m as TextFormatType));
    const run: TextRun = { type: "text", text: node.getTextContent() };
    if (marks.length > 0) run.marks = marks;
    if (link !== undefined) run.link = link;
    out.push(run);
  }
}

export function $readRichTextJSON(): RichTextJSON {
  const content: RichTextBlock[] = [];
  for (const block of $getRoot().getChildren()) {
    if ($isHeadingNode(block)) {
      const level = Number(block.getTag().slice(1));
      content.push({
        type: "heading",
        level: (level <= 3 ? level : 3) as HeadingLevel,
        content: readRuns(block),
      });
    } else if ($isListNode(block)) {
      const items: ListItem[] = [];
      for (const li of block.getChildren()) {
        if ($isListItemNode(li)) items.push({ type: "listitem", content: readRuns(li) });
      }
      content.push({ type: "list", ordered: block.getListType() === "number", items });
    } else if ($isElementNode(block)) {
      content.push({ type: "paragraph", content: readRuns(block) } satisfies Paragraph);
    }
  }
  return { type: "doc", content };
}
