// Representative dirty clipboard HTML, the kind real apps emit on copy. Shared by
// the unit + e2e paste tests. The curated Lexical node set is what strips the
// garbage; these fixtures prove a regression can't silently let it through.

export interface PasteFixture {
  name: string;
  html: string;
  // Substrings that MUST NOT appear anywhere in the resulting doc JSON.
  forbidden: string[];
  // Text that should survive (sanitized) into the content.
  expectText: string;
}

export const WORD_OUTLOOK: PasteFixture = {
  name: "word/outlook",
  html: `<!--[if gte mso 9]><xml><o:OfficeDocumentSettings/></xml><![endif]-->
<p class="MsoNormal" style="mso-margin-top-alt:auto"><o:p></o:p>
<font face="Calibri" size="3">Hello </font><b style="mso-bidi-font-weight:normal">bold</b> world</p>`,
  forbidden: ["mso", "MsoNormal", "<font", "<o:p", "OfficeDocument"],
  expectText: "Hello",
};

export const GOOGLE_DOCS: PasteFixture = {
  name: "google-docs",
  html: `<b style="font-weight:normal" id="docs-internal-guid-abc"><span style="font-weight:400">plain </span><span style="font-weight:700">strong</span></b>`,
  forbidden: ["docs-internal", "font-weight:normal"],
  expectText: "plain",
};

export const MALICIOUS: PasteFixture = {
  name: "malicious",
  html: `<p>safe <a href="javascript:alert(1)">js</a> <a href="https://ok.test">ok</a></p>
<script>steal()</script><img src="x" onerror="hack()"><iframe src="evil"></iframe>`,
  forbidden: ["javascript:", "<script", "onerror", "<iframe", "steal", "hack"],
  expectText: "safe",
};

export const NESTED_TABLE: PasteFixture = {
  name: "nested-mso-table",
  html: `<table class="MsoTableGrid"><tr><td><p class="MsoNormal">cell <b>one</b></p></td>
<td><table><tr><td>nested</td></tr></table></td></tr></table>`,
  forbidden: ["<table", "MsoTableGrid", "mso"],
  expectText: "cell",
};

export const PLAIN_TEXT = "just plain text\nsecond line";

export const ALL_FIXTURES: PasteFixture[] = [WORD_OUTLOOK, GOOGLE_DOCS, MALICIOUS, NESTED_TABLE];
