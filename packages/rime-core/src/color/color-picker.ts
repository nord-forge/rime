import { type CSSResultGroup, LitElement, css, html } from "lit";
import { property, query, state } from "lit/decorators.js";
import {
  type ColorFormat,
  type Hsv,
  formatColor,
  hsvToRgb,
  parseColor,
  rgbToHex,
  rgbToHsv,
} from "./color-convert";

// Emitted on every change with the color in the picker's CURRENT format.
export interface ColorChangeDetail {
  value: string;
}

const FORMATS: ColorFormat[] = ["hex", "rgb", "oklch"];

// <eb-color-picker> — a saturation/value square + hue strip, a text input that
// renders/accepts hex · rgb · oklch, and a format toggle. Pasting a value in any of
// the three formats switches the toggle to the detected format. Themed by --eb-*;
// holds RGB internally (via HSV for the square) so format is purely presentational.
export class EbColorPicker extends LitElement {
  static styles: CSSResultGroup = css`
    :host {
      display: block;
      inline-size: 220px;
      font: var(--eb-font-ui, 13px system-ui);
      color: var(--eb-color-fg, #18181b);
    }
    .sv {
      position: relative;
      block-size: 132px;
      border-radius: var(--eb-radius, 8px) var(--eb-radius, 8px) 0 0;
      cursor: crosshair;
      touch-action: none;
    }
    .sv .wash {
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    .sv .white {
      background: linear-gradient(to right, #fff, transparent);
    }
    .sv .black {
      background: linear-gradient(to top, #000, transparent);
    }
    .thumb {
      position: absolute;
      inline-size: 12px;
      block-size: 12px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4);
      transform: translate(-50%, -50%);
      pointer-events: none;
    }
    .hue {
      position: relative;
      block-size: 12px;
      margin: 10px 0;
      border-radius: 999px;
      cursor: pointer;
      touch-action: none;
      background: linear-gradient(
        to right,
        #f00 0%,
        #ff0 17%,
        #0f0 33%,
        #0ff 50%,
        #00f 67%,
        #f0f 83%,
        #f00 100%
      );
    }
    .hue .thumb {
      top: 50%;
      block-size: 16px;
      inline-size: 16px;
    }
    .row {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    input.text {
      flex: 1;
      min-inline-size: 0;
      block-size: 28px;
      padding: 0 8px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      background: var(--eb-color-bg, #fff);
      color: inherit;
      font: inherit;
    }
    input.text[aria-invalid="true"] {
      border-color: #dc2626;
    }
    .fmt {
      appearance: none;
      block-size: 28px;
      padding: 0 8px;
      border: 1px solid var(--eb-color-border, #e4e4e7);
      border-radius: var(--eb-radius, 6px);
      background: var(--eb-color-bg, #fff);
      color: inherit;
      font: inherit;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.03em;
      text-transform: uppercase;
      cursor: pointer;
    }
  `;

  /** Current value (any supported format). */
  @property({ type: String }) value = "#000000";

  @state() private hsv: Hsv = { h: 0, s: 0, v: 0 };
  @state() private format: ColorFormat = "hex";
  @state() private text = "#000000";
  @state() private invalid = false;

  @query(".sv") private svEl!: HTMLElement;
  @query(".hue") private hueEl!: HTMLElement;

  override willUpdate(changed: Map<PropertyKey, unknown>): void {
    // Sync from the `value` property when it changes externally (not from our own edits).
    if (changed.has("value") && !this.#selfEdit) {
      const parsed = parseColor(this.value);
      if (parsed) {
        this.hsv = rgbToHsv(parsed.rgb);
        this.format = parsed.format;
        this.text = formatColor(parsed.rgb, parsed.format);
      }
    }
    this.#selfEdit = false;
  }

  #selfEdit = false;

  #rgb() {
    return hsvToRgb(this.hsv);
  }

  // Commit the current HSV in the current format: update text + value + emit.
  #commit(): void {
    const formatted = formatColor(this.#rgb(), this.format);
    this.text = formatted;
    this.invalid = false;
    this.#selfEdit = true;
    this.value = formatted;
    this.dispatchEvent(
      new CustomEvent<ColorChangeDetail>("eb-color-change", {
        detail: { value: formatted },
        bubbles: true,
        composed: true,
      }),
    );
  }

  #onText(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    this.text = raw;
    const parsed = parseColor(raw);
    if (!parsed) {
      this.invalid = true;
      return;
    }
    // Pasting a different format auto-switches the toggle to the detected one.
    this.format = parsed.format;
    this.hsv = rgbToHsv(parsed.rgb);
    this.#commit();
  }

  #cycleFormat(): void {
    const i = FORMATS.indexOf(this.format);
    this.format = FORMATS[(i + 1) % FORMATS.length]!;
    this.#commit();
  }

  // Drag handling for the square + hue strip (pointer events; works for touch too).
  #drag(el: HTMLElement, e: PointerEvent, onMove: (x: number, y: number) => void): void {
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const move = (ev: PointerEvent): void => {
      onMove(
        Math.min(1, Math.max(0, (ev.clientX - rect.left) / rect.width)),
        Math.min(1, Math.max(0, (ev.clientY - rect.top) / rect.height)),
      );
    };
    move(e);
    const up = (): void => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
  }

  #onSv(e: PointerEvent): void {
    this.#drag(this.svEl, e, (x, y) => {
      this.hsv = { ...this.hsv, s: x, v: 1 - y };
      this.#commit();
    });
  }

  #onHue(e: PointerEvent): void {
    this.#drag(this.hueEl, e, (x) => {
      this.hsv = { ...this.hsv, h: x * 360 };
      this.#commit();
    });
  }

  override render() {
    const hueRgb = rgbToHex(hsvToRgb({ h: this.hsv.h, s: 1, v: 1 }));
    return html`
      <div
        class="sv"
        style="background:${hueRgb}"
        @pointerdown=${(e: PointerEvent) => this.#onSv(e)}
        role="slider"
        aria-label="Saturation and brightness"
      >
        <div class="wash white"></div>
        <div class="wash black"></div>
        <div
          class="thumb"
          style="left:${this.hsv.s * 100}%; top:${(1 - this.hsv.v) * 100}%; background:${rgbToHex(
            this.#rgb(),
          )}"
        ></div>
      </div>

      <div
        class="hue"
        @pointerdown=${(e: PointerEvent) => this.#onHue(e)}
        role="slider"
        aria-label="Hue"
      >
        <div class="thumb" style="left:${(this.hsv.h / 360) * 100}%; background:${hueRgb}"></div>
      </div>

      <div class="row">
        <input
          class="text"
          type="text"
          spellcheck="false"
          aria-label="Color value"
          aria-invalid=${this.invalid}
          .value=${this.text}
          @input=${(e: Event) => this.#onText(e)}
        />
        <button
          type="button"
          class="fmt"
          title="Switch color format"
          @click=${() => this.#cycleFormat()}
        >
          ${this.format}
        </button>
      </div>
    `;
  }
}

if (!customElements.get("eb-color-picker")) {
  customElements.define("eb-color-picker", EbColorPicker);
}
