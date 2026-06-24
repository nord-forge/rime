import { describe, expect, test } from "bun:test";
import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
} from "@nord-forge/rime-model";
import {
  blockLabel,
  insertMessage,
  moveMessage,
  parentLabel,
  removeMessage,
} from "./announce-messages";

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

/** section: col_1 [text, button], col_2 [text]. */
function buildDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 2);
  section.children[0]!.children.push(createTextBlock(newId), createButtonBlock(newId));
  section.children[1]!.children.push(createTextBlock(newId));
  doc.children.push(section);
  return doc;
}

describe("blockLabel", () => {
  test("maps types to human labels", () => {
    const doc = buildDoc();
    expect(blockLabel(doc.children[0]!.children[0]!.children[1]!)).toBe("Button");
    expect(blockLabel(doc.children[0]!.children[0]!.children[0]!)).toBe("Text");
  });
});

describe("parentLabel", () => {
  test("1-based Column N / Section N", () => {
    const doc = buildDoc();
    expect(parentLabel(doc, doc.children[0]!.children[0]!.id)).toBe("Column 1");
    expect(parentLabel(doc, doc.children[0]!.children[1]!.id)).toBe("Column 2");
    expect(parentLabel(doc, doc.children[0]!.id)).toBe("Section 1");
  });
});

describe("moveMessage", () => {
  test("includes label, parent, and 1-based position of total", () => {
    const doc = buildDoc();
    const buttonId = doc.children[0]!.children[0]!.children[1]!.id; // col1 idx1 of 2
    expect(moveMessage(doc, buttonId)).toBe("Moved Button to Column 1, position 2 of 2");
  });
});

describe("insertMessage", () => {
  test("describes the inserted block's resting place", () => {
    const doc = buildDoc();
    const textInCol2 = doc.children[0]!.children[1]!.children[0]!.id; // col2 idx0 of 1
    expect(insertMessage(doc, textInCol2)).toBe("Inserted Text into Column 2, position 1 of 1");
  });
});

describe("removeMessage", () => {
  test("names the block + the parent it was removed from", () => {
    const doc = buildDoc();
    const button = doc.children[0]!.children[0]!.children[1]!;
    const col1Id = doc.children[0]!.children[0]!.id;
    expect(removeMessage(doc, button, col1Id)).toBe("Removed Button from Column 1");
  });
});
