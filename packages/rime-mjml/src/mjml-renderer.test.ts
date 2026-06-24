import { describe, expect, test } from "bun:test";
import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
  type RichTextJSON,
} from "@nord-forge/rime-model";
import {
  docToMjml,
  escapeHtml,
  MjmlRenderer,
  RenderError,
  richTextToInlineHtml,
  styleToMjmlAttrs,
} from "./index";

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

describe("richTextToInlineHtml", () => {
  test("paragraphs, marks (nested), and links", () => {
    const rt: RichTextJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "plain " },
            { type: "text", text: "bi", marks: ["bold", "italic"] },
            { type: "text", text: "link", link: "https://x.test", marks: ["underline"] },
          ],
        },
        { type: "paragraph", content: [] },
      ],
    };
    const html = richTextToInlineHtml(rt);
    expect(html).toBe(
      "<p>plain <em><strong>bi</strong></em>" +
        '<a href="https://x.test"><u>link</u></a></p><p></p>',
    );
  });

  test("escapes HTML-significant characters in text and links", () => {
    const rt: RichTextJSON = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: 'a<b>&"c', link: 'https://x.test?a=1&b="2"' }],
        },
      ],
    };
    const html = richTextToInlineHtml(rt);
    expect(html).toContain("a&lt;b&gt;&amp;");
    expect(html).toContain('href="https://x.test?a=1&amp;b=&quot;2&quot;"');
    expect(html).not.toContain("<b>");
  });

  test("escapeHtml basics", () => {
    expect(escapeHtml('<a> & "x"')).toBe('&lt;a&gt; &amp; "x"');
  });
});

describe("styleToMjmlAttrs", () => {
  test("maps padding, background, align with px units", () => {
    expect(styleToMjmlAttrs({ paddingTop: 8, backgroundColor: "#fff", align: "center" })).toEqual({
      "padding-top": "8px",
      "background-color": "#fff",
      align: "center",
    });
  });

  test("empty / undefined style → no attrs", () => {
    expect(styleToMjmlAttrs(undefined)).toEqual({});
    expect(styleToMjmlAttrs({})).toEqual({});
  });
});

/** A doc covering every core block type. */
function fullDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 1);
  const col = section.children[0]!;
  const text = createTextBlock(newId, {
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
  });
  col.children.push(
    text,
    { id: newId("image"), type: "image", src: "https://x.test/i.png", alt: "pic", style: {} },
    createButtonBlock(newId, "Click", "https://x.test"),
    { id: newId("divider"), type: "divider", style: {} },
    { id: newId("spacer"), type: "spacer", height: 24 },
  );
  doc.children.push(section);
  return doc;
}

describe("docToMjml", () => {
  test("emits an element for every core block type", () => {
    const src = docToMjml(fullDoc());
    expect(src).toContain("<mjml>");
    expect(src).toContain("<mj-body");
    expect(src).toContain("<mj-section");
    expect(src).toContain("<mj-column");
    expect(src).toContain("<mj-text>");
    expect(src).toContain("<mj-image");
    expect(src).toContain("<mj-button");
    expect(src).toContain("<mj-divider");
    expect(src).toContain('<mj-spacer height="24px" />');
  });

  test("body carries contentWidth + background, column carries width%", () => {
    const src = docToMjml(fullDoc());
    expect(src).toContain('width="600px"');
    expect(src).toContain('background-color="#f4f4f5"');
    expect(src).toContain('width="100%"');
  });

  test("unknown node type throws RenderError naming type + id", () => {
    const doc = fullDoc();
    (doc.children[0]!.children[0]!.children[0] as { type: string }).type = "video";
    expect(() => docToMjml(doc)).toThrow(RenderError);
    try {
      docToMjml(doc);
    } catch (e) {
      expect((e as Error).message).toContain('"video"');
    }
  });

  test("extra BlockRenderer overrides a built-in type", () => {
    const src = docToMjml(fullDoc(), {}, [
      { type: "button", renderExport: () => "<mj-raw>CUSTOM</mj-raw>" },
    ]);
    expect(src).toContain("<mj-raw>CUSTOM</mj-raw>");
    expect(src).not.toContain("<mj-button");
  });
});

describe("MjmlRenderer.render", () => {
  test("compiles to Outlook-safe HTML (mso scaffolding present)", async () => {
    const html = await new MjmlRenderer().render(fullDoc());
    expect(html.toLowerCase()).toContain("<!doctype html");
    expect(html.toLowerCase()).toContain("if mso"); // Outlook ghost-table conditionals
  });

  test("implements Renderer and returns a string", async () => {
    const html = await new MjmlRenderer().render(createEmptyDoc(ids()));
    expect(typeof html).toBe("string");
    expect(html).toContain("<html");
  });

  test("accepts the minify option without error (no-op in mjml-core)", async () => {
    const doc = fullDoc();
    const html = await new MjmlRenderer().render(doc, { minify: true });
    expect(html.toLowerCase()).toContain("<!doctype html");
  });

  test("escaped text survives into compiled HTML (no raw injection)", async () => {
    const newId = ids();
    const doc = createEmptyDoc(newId);
    const section = createSection(newId, 1);
    section.children[0]!.children.push(
      createTextBlock(newId, {
        type: "doc",
        content: [{ type: "paragraph", content: [{ type: "text", text: "<script>x</script>" }] }],
      }),
    );
    doc.children.push(section);
    const html = await new MjmlRenderer().render(doc);
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
