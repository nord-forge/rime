import type { BaseNode, BlockStyle } from "@nord-forge/rime-model";
import type { BlockDefinition } from "../types";
import { applyStyle, el } from "../../canvas/render-node/render-node";
import { escapeHtml } from "./mjml-attrs";

export type TableBorder = "none" | "thin" | "thick";

export interface TableBlock extends BaseNode {
  type: "table";
  // rows.length × cols grid of plain-text cell values.
  rows: string[][];
  // First row rendered as a <th> header row.
  header: boolean;
  border: TableBorder;
  style: BlockStyle;
}

const BORDER_CSS: Record<TableBorder, string> = {
  none: "0",
  thin: "1px solid #cccccc",
  thick: "2px solid #888888",
};

const CELL_PADDING = "8px";

export const tableBlock: BlockDefinition<TableBlock> = {
  type: "table",
  palette: {
    label: "Table",
    icon: "⊞",
    category: "Content",
    defaults: {
      rows: [
        ["", ""],
        ["", ""],
      ],
      header: false,
      border: "thin",
      style: {},
    },
  },
  schema: {
    // NOTE: the `rows` grid is a 2-D structure; the generic `list` repeater edits a
    // flat Array<Record<…>>, which is awkward for a rows × cols grid. v1 declares the
    // field so the properties panel surfaces it; a dedicated grid control (add/remove
    // rows + columns) is a follow-up in the properties-panel ticket.
    fields: [
      { key: "rows", label: "Rows", type: "list", group: "Content" },
      { key: "header", label: "Header row", type: "boolean", group: "Layout" },
      {
        key: "border",
        label: "Border",
        type: "select",
        group: "Layout",
        options: [
          { value: "none", label: "None" },
          { value: "thin", label: "Thin" },
          { value: "thick", label: "Thick" },
        ],
      },
      { key: "style.paddingTop", label: "Padding", type: "spacing", group: "Spacing" },
    ],
  },
  // The ONE block where a real <table> appears on the canvas — the table IS the
  // content (the canvas otherwise avoids tables per §6.2).
  renderCanvas: (node, ctx) => {
    const e = el(ctx.doc, node);
    applyStyle(e, node.style);
    const border = BORDER_CSS[node.border];
    const table = ctx.doc.createElement("table");
    table.style.borderCollapse = "collapse";
    table.style.width = "100%";

    node.rows.forEach((row, r) => {
      const tr = ctx.doc.createElement("tr");
      const isHeader = node.header && r === 0;
      for (const cell of row) {
        const td = ctx.doc.createElement(isHeader ? "th" : "td");
        td.textContent = cell;
        td.style.border = border;
        td.style.padding = CELL_PADDING;
        td.style.textAlign = "left";
        tr.append(td);
      }
      table.append(tr);
    });
    e.append(table);
    return e;
  },
  // Raw-table fallback (MJML has no generic table): email-safe <table> with inline
  // styles, header row as <th> when toggled, the chosen border inlined. Every cell
  // value is escaped.
  renderExport: (node) => {
    const border = BORDER_CSS[node.border];
    const cellStyle = `border:${border};padding:${CELL_PADDING};text-align:left`;
    const rows = node.rows
      .map((row, r) => {
        const tag = node.header && r === 0 ? "th" : "td";
        const cells = row
          .map((cell) => `<${tag} style="${cellStyle}">${escapeHtml(cell)}</${tag}>`)
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");
    const table =
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
      `style="border-collapse:collapse;width:100%">${rows}</table>`;
    return { raw: `<mj-raw>${table}</mj-raw>` };
  },
};
