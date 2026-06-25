// Zero-dependency color math for the color picker: sRGB (hex / rgb) ↔ HSV (the
// saturation-square + hue-strip model) ↔ OKLCH (perceptual, CSS Color 4). The OKLab
// transform is Björn Ottosson's (https://bottosson.github.io/posts/oklab/, public
// domain). Kept in core (no `culori`/`colorjs` dep) so the bundle stays tight.

export type ColorFormat = "hex" | "rgb" | "oklch";

/** An sRGB color, channels 0–255. The picker's internal source of truth. */
export interface Rgb {
  r: number;
  g: number;
  b: number;
}

const clamp = (n: number, lo = 0, hi = 1): number => Math.min(hi, Math.max(lo, n));
const clamp255 = (n: number): number => Math.round(clamp(n, 0, 255));

// ── hex ──────────────────────────────────────────────────────────────────────
export function rgbToHex({ r, g, b }: Rgb): string {
  const h = (n: number): string => clamp255(n).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Parse #rgb / #rrggbb (with or without leading #). Returns null if unparseable. */
export function hexToRgb(input: string): Rgb | null {
  const s = input.trim().replace(/^#/, "");
  const m3 = /^([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(s);
  if (m3) {
    return {
      r: parseInt(m3[1]! + m3[1]!, 16),
      g: parseInt(m3[2]! + m3[2]!, 16),
      b: parseInt(m3[3]! + m3[3]!, 16),
    };
  }
  const m6 = /^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(s);
  if (m6) {
    return { r: parseInt(m6[1]!, 16), g: parseInt(m6[2]!, 16), b: parseInt(m6[3]!, 16) };
  }
  return null;
}

// ── HSV ⟷ RGB ─────────────────────────────────────────────────────────────────
/** h 0–360, s 0–1, v 0–1. */
export interface Hsv {
  h: number;
  s: number;
  v: number;
}

export function rgbToHsv({ r, g, b }: Rgb): Hsv {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}

export function hsvToRgb({ h, s, v }: Hsv): Rgb {
  const c = v * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;
  if (hp < 1) [r, g, b] = [c, x, 0];
  else if (hp < 2) [r, g, b] = [x, c, 0];
  else if (hp < 3) [r, g, b] = [0, c, x];
  else if (hp < 4) [r, g, b] = [0, x, c];
  else if (hp < 5) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  const m = v - c;
  return { r: clamp255((r + m) * 255), g: clamp255((g + m) * 255), b: clamp255((b + m) * 255) };
}

// ── OKLCH ⟷ RGB ───────────────────────────────────────────────────────────────
const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055;

export interface Oklch {
  l: number; // 0–1
  c: number; // 0–~0.4
  h: number; // 0–360
}

export function rgbToOklch({ r, g, b }: Rgb): Oklch {
  const lr = srgbToLinear(r / 255);
  const lg = srgbToLinear(g / 255);
  const lb = srgbToLinear(b / 255);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const okl = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const oka = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const okb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const chroma = Math.hypot(oka, okb);
  let hue = (Math.atan2(okb, oka) * 180) / Math.PI;
  if (hue < 0) hue += 360;
  return { l: okl, c: chroma, h: chroma < 1e-4 ? 0 : hue };
}

export function oklchToRgb({ l: okl, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const oka = c * Math.cos(hr);
  const okb = c * Math.sin(hr);

  const l_ = okl + 0.3963377774 * oka + 0.2158037573 * okb;
  const m_ = okl - 0.1055613458 * oka - 0.0638541728 * okb;
  const s_ = okl - 0.0894841775 * oka - 1.291485548 * okb;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: clamp255(linearToSrgb(clamp(lr)) * 255),
    g: clamp255(linearToSrgb(clamp(lg)) * 255),
    b: clamp255(linearToSrgb(clamp(lb)) * 255),
  };
}

// ── Formatting + parsing ──────────────────────────────────────────────────────
const r2 = (n: number): number => Math.round(n * 100) / 100;
const r3 = (n: number): number => Math.round(n * 1000) / 1000;

/** Render an RGB color as the requested CSS string. */
export function formatColor(rgb: Rgb, format: ColorFormat): string {
  if (format === "hex") return rgbToHex(rgb);
  if (format === "rgb") return `rgb(${clamp255(rgb.r)} ${clamp255(rgb.g)} ${clamp255(rgb.b)})`;
  const { l, c, h } = rgbToOklch(rgb);
  return `oklch(${r3(l)} ${r3(c)} ${r2(h)})`;
}

export interface ParsedColor {
  rgb: Rgb;
  format: ColorFormat;
}

const RGB_RE = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;
const OKLCH_RE = /^oklch\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+)/i;

const pct = (s: string, scale: number): number =>
  s.endsWith("%") ? (parseFloat(s) / 100) * scale : parseFloat(s);

/**
 * Detect and parse a color string in ANY of hex / rgb() / oklch(), returning the
 * RGB plus the format it was written in (so a paste can switch the UI to it).
 */
export function parseColor(input: string): ParsedColor | null {
  const s = input.trim();
  const hex = hexToRgb(s);
  if (hex && /^#?[0-9a-f]{3}([0-9a-f]{3})?$/i.test(s.replace(/^#/, ""))) {
    return { rgb: hex, format: "hex" };
  }
  const rgbM = RGB_RE.exec(s);
  if (rgbM) {
    return {
      rgb: { r: clamp255(+rgbM[1]!), g: clamp255(+rgbM[2]!), b: clamp255(+rgbM[3]!) },
      format: "rgb",
    };
  }
  const okM = OKLCH_RE.exec(s);
  if (okM) {
    const l = pct(okM[1]!, 1);
    const c = pct(okM[2]!, 0.4);
    const h = parseFloat(okM[3]!);
    return { rgb: oklchToRgb({ l, c, h }), format: "oklch" };
  }
  return null;
}
