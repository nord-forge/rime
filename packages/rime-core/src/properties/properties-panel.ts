// <eb-properties-panel> — the right-hand chrome panel (§6.5). Schema-driven: it
// reads the selected block's BlockSchema from the registry and renders a form, so
// a custom block gets a properties form for free. Every edit goes through the
// ENV-06 updateNode op (never in-place mutation) and is emitted as eb-doc-change,
// so undo/redo covers property edits too. Chrome — Shadow DOM, themed by --eb-*.

import { type CSSResultGroup, LitElement, css, html, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import {
  createIdFactory,
  type IdFactory,
  type NodeId,
  type OpResult,
  type RimeDoc,
  updateNode,
} from "@nord-forge/rime-model";
import type { BaseNode } from "@nord-forge/rime-model";
import { blockRegistry, type BlockRegistry } from "../blocks/registry";
import type { FieldDef } from "../blocks/schema";
import { findNodeById } from "../a11y/announce-messages/announce-messages";
import { getByPath, nestedPartial } from "./field-path";
import { columnsForCount } from "./columns-op";
import { resolveUpload } from "./image-upload";
import { type ColorChangeDetail, EbColorPicker } from "../color/color-picker";

// Referenced so the <eb-color-picker> element is registered when the panel loads.
void EbColorPicker;

export interface DocChangeDetail {
  doc: RimeDoc;
  patch: OpResult["patch"];
  // The inverse patch, so the editor's undo/redo covers property edits too.
  inverse: OpResult["inverse"];
}

const ALIGNMENTS = ["left", "center", "right"] as const;

export class EbPropertiesPanel extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      block-size: 100%;
      overflow-y: auto;
      background: var(--eb-color-surface, var(--eb-color-bg, #fff));
      color: var(--eb-color-fg, #18181b);
      font: var(--eb-font-ui, 14px system-ui);
    }
    .empty {
      padding: 16px;
      opacity: 0.6;
    }
    .group {
      border-block-end: 1px solid var(--eb-color-border, #e4e4e7);
      padding: 12px 16px;
    }
    .group > h3 {
      margin: 0 0 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.6;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-block-end: 10px;
    }
    .field > label {
      font-size: 12px;
    }
    input,
    select,
    textarea {
      inline-size: 100%;
      box-sizing: border-box;
      padding: 5px 7px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      font: inherit;
      color: var(--eb-color-fg, #18181b);
      background: var(--eb-color-bg, #fff);
    }
    textarea {
      min-block-size: 80px;
      resize: vertical;
    }
    textarea.code {
      font-family: var(--eb-font-mono, ui-monospace, monospace);
    }
    .spacing,
    .align {
      display: flex;
      gap: 4px;
    }
    .align button {
      flex: 1;
      block-size: 28px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      background: var(--eb-color-bg, #fff);
      color: inherit;
      cursor: pointer;
    }
    .align button[aria-pressed="true"] {
      background: var(--eb-color-accent, #5b5bd6);
      color: #fff;
      border-color: var(--eb-color-accent, #5b5bd6);
    }
    .check {
      flex-direction: row;
      align-items: center;
      gap: 8px;
    }
    .hint {
      font-size: 12px;
      opacity: 0.6;
    }
    .image-upload {
      margin-block-start: 4px;
    }
    .upload-btn {
      block-size: 28px;
      padding: 0 10px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      background: var(--eb-color-bg, #fff);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .upload-btn:hover:not(:disabled) {
      background: color-mix(in srgb, var(--eb-color-accent, #5b5bd6) 12%, transparent);
    }
    .upload-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .error {
      display: block;
      margin-block-start: 4px;
      font-size: 12px;
      color: var(--eb-color-danger, #dc2626);
    }
    .swatch {
      display: flex;
      align-items: center;
      gap: 8px;
      inline-size: 100%;
      block-size: 30px;
      padding: 0 8px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      background: var(--eb-color-bg, #fff);
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .swatch .chip {
      inline-size: 18px;
      block-size: 18px;
      border-radius: 4px;
      border: 1px solid rgba(0, 0, 0, 0.15);
      flex: 0 0 auto;
    }
    .swatch .val {
      font:
        12px ui-monospace,
        monospace;
      color: var(--eb-color-fg, #18181b);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .picker {
      margin-block-start: 8px;
      padding: 10px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 8px);
      background: var(--eb-color-surface, var(--eb-color-bg, #fff));
    }
    .list-row {
      display: flex;
      gap: 4px;
      margin-block-end: 4px;
    }
    .list-row > * {
      flex: 1;
    }
    button.row-remove,
    button.row-add {
      flex: 0 0 auto;
      block-size: 28px;
      padding: 0 8px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      background: var(--eb-color-bg, #fff);
      color: inherit;
      cursor: pointer;
    }
  `;

  @property({ attribute: false }) doc: RimeDoc | null = null;
  @property({ attribute: false }) selectedId: NodeId | null = null;
  @property({ attribute: false }) registry: BlockRegistry = blockRegistry;
  // Host uploader for image fields. When absent, the file-picker is disabled (the URL
  // field still works) — the library never uploads/stores anything itself.
  @property({ attribute: false }) onImageUpload?: (file: File) => Promise<string>;

  // Per-field-key upload UI state (pending spinner / inline error message).
  @state() private uploading: Record<string, boolean> = {};
  @state() private uploadError: Record<string, string> = {};
  // The field key whose color picker popover is open (one at a time), or null.
  @state() private openColor: string | null = null;

  // Injectable id factory (deterministic in tests).
  newId: IdFactory = createIdFactory();

  // Coalesce rapid input (color/number drags) into one doc op per idle frame.
  #pending: Record<string, unknown> | null = null;
  #flushHandle: ReturnType<typeof setTimeout> | null = null;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    // Drop any pending debounced flush so it can't dispatch eb-doc-change from a
    // detached element after teardown.
    if (this.#flushHandle) {
      clearTimeout(this.#flushHandle);
      this.#flushHandle = null;
    }
    this.#pending = null;
  }

  #node(): BaseNode | null {
    if (!this.doc || !this.selectedId) return null;
    return (findNodeById(this.doc, this.selectedId) as BaseNode | null) ?? null;
  }

  // Apply a field edit: merge into a pending partial, debounced to one op/frame.
  #edit(key: string, value: unknown, immediate = false): void {
    const partial = nestedPartial(key, value);
    this.#pending = mergeDeep(this.#pending ?? {}, partial);
    if (this.#flushHandle) clearTimeout(this.#flushHandle);
    if (immediate) {
      this.#flush();
    } else {
      this.#flushHandle = setTimeout(() => this.#flush(), 0);
    }
  }

  #flush(): void {
    this.#flushHandle = null;
    const partial = this.#pending;
    this.#pending = null;
    if (!partial || !this.doc || !this.selectedId) return;
    let op: OpResult;
    try {
      op = updateNode(this.doc, this.selectedId, partial, {
        extraLeafTypes: this.registry.leafTypes(),
        extraSectionTypes: this.registry.sectionTypes(),
      });
    } catch {
      return; // an edit that would invalidate the doc is dropped
    }
    this.dispatchEvent(
      new CustomEvent<DocChangeDetail>("eb-doc-change", {
        detail: { doc: op.doc, patch: op.patch, inverse: op.inverse },
        bubbles: true,
        composed: true,
      }),
    );
  }

  // Section-only: change the column count, redistributing widths to sum to 100.
  #setColumnCount(count: number): void {
    const node = this.#node();
    if (!node || node.type !== "section") return;
    const children = columnsForCount(
      (node as unknown as { children: never[] }).children,
      count,
      this.newId,
    );
    this.#edit("children", children, true);
  }

  override render() {
    const node = this.#node();
    if (!node) {
      return html`<div class="empty">Select a block to edit</div>`;
    }
    const def = this.registry.get(node.type);
    if (!def) {
      return html`<div class="empty">No editable properties for “${node.type}”.</div>`;
    }
    const groups = groupFields(def.schema.fields);
    return html`
      ${node.type === "section" ? this.#renderColumnsControl(node) : nothing}
      ${groups.map(
        ([group, fields]) => html`
          <div class="group">
            <h3>${group}</h3>
            ${fields.map((f) => this.#renderField(node, f))}
          </div>
        `,
      )}
    `;
  }

  #renderColumnsControl(node: BaseNode) {
    const count = (node as unknown as { children: unknown[] }).children.length;
    return html`
      <div class="group">
        <h3>Columns</h3>
        <div class="field">
          <label>Column count</label>
          <input
            type="number"
            min="1"
            max="6"
            .value=${String(count)}
            @input=${(e: Event) =>
              this.#setColumnCount(Number((e.target as HTMLInputElement).value))}
          />
        </div>
      </div>
    `;
  }

  #renderField(node: BaseNode, field: FieldDef) {
    const value = getByPath(node, field.key);
    const id = `f-${field.key}`;
    switch (field.type) {
      case "richtext":
        return html`<div class="field">
          <label>${field.label}</label><span class="hint">Edit on the canvas.</span>
        </div>`;
      case "boolean":
        return html`<div class="field check">
          <input
            id=${id}
            type="checkbox"
            .checked=${Boolean(value)}
            @change=${(e: Event) =>
              this.#edit(field.key, (e.target as HTMLInputElement).checked, true)}
          /><label for=${id}>${field.label}</label>
        </div>`;
      case "color": {
        const current = typeof value === "string" && value !== "" ? value : "#000000";
        const open = this.openColor === field.key;
        return html`<div class="field">
          <label for=${id}>${field.label}</label>
          <button
            id=${id}
            type="button"
            class="swatch"
            aria-expanded=${open}
            @click=${() => (this.openColor = open ? null : field.key)}
          >
            <span class="chip" style="background:${current}"></span>
            <span class="val">${current}</span>
          </button>
          ${open
            ? html`<eb-color-picker
                class="picker"
                .value=${current}
                @eb-color-change=${(e: Event) =>
                  this.#edit(field.key, (e as CustomEvent<ColorChangeDetail>).detail.value)}
              ></eb-color-picker>`
            : nothing}
        </div>`;
      }
      case "number":
        return html`<div class="field">
          <label for=${id}>${field.label}</label>
          <input
            id=${id}
            type="number"
            min=${field.min ?? nothing}
            max=${field.max ?? nothing}
            step=${field.step ?? nothing}
            .value=${value == null ? "" : String(value)}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              this.#edit(field.key, v === "" ? undefined : Number(v));
            }}
          />
        </div>`;
      case "spacing":
        return html`<div class="field">
          <label for=${id}>${field.label}</label>
          <input
            id=${id}
            type="number"
            min="0"
            .value=${value == null ? "" : String(value)}
            @input=${(e: Event) => {
              const v = (e.target as HTMLInputElement).value;
              this.#edit(field.key, v === "" ? undefined : Number(v));
            }}
          />
        </div>`;
      case "align":
        return html`<div class="field">
          <label>${field.label}</label>
          <div class="align" role="group" aria-label=${field.label}>
            ${ALIGNMENTS.map(
              (a) => html`<button
                type="button"
                aria-pressed=${value === a}
                @click=${() => this.#edit(field.key, a, true)}
              >
                ${a}
              </button>`,
            )}
          </div>
        </div>`;
      case "select":
        return html`<div class="field">
          <label for=${id}>${field.label}</label>
          <select
            id=${id}
            .value=${typeof value === "string" ? value : ""}
            @change=${(e: Event) =>
              this.#edit(field.key, (e.target as HTMLSelectElement).value, true)}
          >
            ${(field.options ?? []).map(
              (o) =>
                html`<option value=${o.value} ?selected=${o.value === value}>${o.label}</option>`,
            )}
          </select>
        </div>`;
      case "multiline":
      case "code":
        return html`<div class="field">
          <label for=${id}>${field.label}</label>
          <textarea
            id=${id}
            class=${field.type === "code" ? "code" : ""}
            .value=${typeof value === "string" ? value : ""}
            @input=${(e: Event) => this.#edit(field.key, (e.target as HTMLTextAreaElement).value)}
          ></textarea>
        </div>`;
      case "list":
        return this.#renderListField(field, value);
      case "image":
        return this.#renderImageField(field, value);
      case "url":
      case "text":
      default:
        return html`<div class="field">
          <label for=${id}>${field.label}</label>
          <input
            id=${id}
            type=${field.type === "url" ? "url" : "text"}
            .value=${typeof value === "string" ? value : ""}
            @input=${(e: Event) => this.#edit(field.key, (e.target as HTMLInputElement).value)}
          />
        </div>`;
    }
  }

  // An image source field: a URL input (paste a URL directly) plus a host-driven
  // file uploader. The library uploads NOTHING itself — it hands the File to
  // config.onImageUpload and stores the returned URL. No callback → the picker is
  // disabled with a hint, but the URL field stays usable.
  #renderImageField(field: FieldDef, value: unknown) {
    const id = `f-${field.key}`;
    const canUpload = typeof this.onImageUpload === "function";
    const pending = this.uploading[field.key] === true;
    const error = this.uploadError[field.key];
    return html`<div class="field">
      <label for=${id}>${field.label}</label>
      <input
        id=${id}
        type="url"
        placeholder="https://… or upload"
        .value=${typeof value === "string" ? value : ""}
        @input=${(e: Event) => this.#edit(field.key, (e.target as HTMLInputElement).value)}
      />
      <div class="image-upload">
        <button
          type="button"
          class="upload-btn"
          ?disabled=${!canUpload || pending}
          @click=${(e: Event) => {
            const input = (e.target as HTMLElement)
              .closest(".image-upload")
              ?.querySelector<HTMLInputElement>("input[type=file]");
            input?.click();
          }}
        >
          ${pending ? "Uploading…" : "Choose image"}
        </button>
        <input
          type="file"
          accept="image/*"
          hidden
          @change=${(e: Event) => this.#onUpload(field.key, e)}
        />
      </div>
      ${!canUpload
        ? html`<span class="hint">Configure <code>onImageUpload</code> to enable uploads.</span>`
        : nothing}
      ${error ? html`<span class="error" role="alert">${error}</span>` : nothing}
    </div>`;
  }

  async #onUpload(key: string, e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ""; // allow re-picking the same file
    if (!file) return;
    this.uploading = { ...this.uploading, [key]: true };
    this.uploadError = { ...this.uploadError, [key]: "" };
    const outcome = await resolveUpload(this.onImageUpload, file);
    if (outcome.kind === "url") this.#edit(key, outcome.url, true);
    else if (outcome.kind === "error") {
      this.uploadError = { ...this.uploadError, [key]: outcome.message };
    }
    this.uploading = { ...this.uploading, [key]: false };
  }

  // A repeater for list fields whose rows are objects keyed by itemFields. A list
  // without itemFields (e.g. the table grid) gets a read-only note — a dedicated
  // grid control is out of scope for v1.
  #renderListField(field: FieldDef, value: unknown) {
    const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
    if (!field.itemFields || field.itemFields.length === 0) {
      return html`<div class="field">
        <label>${field.label}</label>
        <span class="hint">${rows.length} item(s) — grid editing coming soon.</span>
      </div>`;
    }
    const items = field.itemFields;
    const writeRows = (next: Record<string, unknown>[]) => this.#edit(field.key, next, true);
    return html`<div class="field">
      <label>${field.label}</label>
      ${rows.map(
        (row, i) => html`<div class="list-row">
          ${items.map(
            (item) => html`<input
              type=${item.type === "url" ? "url" : "text"}
              aria-label=${item.label}
              .value=${typeof row[item.key] === "string" ? (row[item.key] as string) : ""}
              @input=${(e: Event) => {
                const next = rows.map((r, j) =>
                  j === i ? { ...r, [item.key]: (e.target as HTMLInputElement).value } : r,
                );
                writeRows(next);
              }}
            />`,
          )}
          <button
            type="button"
            class="row-remove"
            aria-label="Remove row"
            @click=${() => writeRows(rows.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>`,
      )}
      <button
        type="button"
        class="row-add"
        @click=${() => writeRows([...rows, Object.fromEntries(items.map((it) => [it.key, ""]))])}
      >
        + Add
      </button>
    </div>`;
  }
}

function groupFields(fields: FieldDef[]): [string, FieldDef[]][] {
  const order: string[] = [];
  const byGroup = new Map<string, FieldDef[]>();
  for (const f of fields) {
    const g = f.group ?? "Properties";
    if (!byGroup.has(g)) {
      byGroup.set(g, []);
      order.push(g);
    }
    byGroup.get(g)!.push(f);
  }
  return order.map((g) => [g, byGroup.get(g)!]);
}

// Deep-merge nested partials so coalesced edits to e.g. style.x and style.y in the
// same frame don't clobber each other.
function mergeDeep(
  base: Record<string, unknown>,
  add: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(add)) {
    const prev = out[k];
    if (
      prev != null &&
      typeof prev === "object" &&
      !Array.isArray(prev) &&
      v != null &&
      typeof v === "object" &&
      !Array.isArray(v)
    ) {
      out[k] = mergeDeep(prev as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

if (!customElements.get("eb-properties-panel")) {
  customElements.define("eb-properties-panel", EbPropertiesPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    "eb-properties-panel": EbPropertiesPanel;
  }
}
