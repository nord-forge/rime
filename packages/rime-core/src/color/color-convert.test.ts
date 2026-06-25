import { describe, expect, test } from "bun:test";
import {
  formatColor,
  hexToRgb,
  hsvToRgb,
  oklchToRgb,
  parseColor,
  rgbToHex,
  rgbToHsv,
  rgbToOklch,
  type Rgb,
} from "./color-convert";

const SAMPLES: Rgb[] = [
  { r: 0, g: 0, b: 0 },
  { r: 255, g: 255, b: 255 },
  { r: 91, g: 91, b: 214 }, // indigo accent
  { r: 220, g: 38, b: 38 },
  { r: 16, g: 185, b: 129 },
  { r: 124, g: 58, b: 237 },
  { r: 1, g: 2, b: 3 },
];

describe("hex", () => {
  test("rgbToHex / hexToRgb round-trip", () => {
    for (const c of SAMPLES) expect(hexToRgb(rgbToHex(c))).toEqual(c);
  });
  test("parses #rgb shorthand and bare hex", () => {
    expect(hexToRgb("#f0a")).toEqual({ r: 255, g: 0, b: 170 });
    expect(hexToRgb("5b5bd6")).toEqual({ r: 91, g: 91, b: 214 });
  });
  test("rejects garbage", () => {
    expect(hexToRgb("#zz")).toBeNull();
    expect(hexToRgb("nope")).toBeNull();
  });
});

describe("HSV", () => {
  test("rgbToHsv / hsvToRgb round-trip within 1 channel step", () => {
    for (const c of SAMPLES) {
      const back = hsvToRgb(rgbToHsv(c));
      expect(Math.abs(back.r - c.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - c.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - c.b)).toBeLessThanOrEqual(1);
    }
  });
  test("pure red is h=0 s=1 v=1", () => {
    expect(rgbToHsv({ r: 255, g: 0, b: 0 })).toEqual({ h: 0, s: 1, v: 1 });
  });
});

describe("OKLCH", () => {
  test("rgbToOklch / oklchToRgb round-trip within 1 channel step", () => {
    for (const c of SAMPLES) {
      const back = oklchToRgb(rgbToOklch(c));
      expect(Math.abs(back.r - c.r)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.g - c.g)).toBeLessThanOrEqual(1);
      expect(Math.abs(back.b - c.b)).toBeLessThanOrEqual(1);
    }
  });
  test("white is ~L1 C0", () => {
    const w = rgbToOklch({ r: 255, g: 255, b: 255 });
    expect(w.l).toBeCloseTo(1, 2);
    expect(w.c).toBeCloseTo(0, 2);
  });
});

describe("formatColor", () => {
  const indigo = { r: 91, g: 91, b: 214 };
  test("hex / rgb forms", () => {
    expect(formatColor(indigo, "hex")).toBe("#5b5bd6");
    expect(formatColor(indigo, "rgb")).toBe("rgb(91 91 214)");
  });
  test("oklch form is well-shaped and re-parses to the same color", () => {
    const s = formatColor(indigo, "oklch");
    expect(s).toMatch(/^oklch\([\d.]+ [\d.]+ [\d.]+\)$/);
    const back = parseColor(s)!;
    expect(Math.abs(back.rgb.r - indigo.r)).toBeLessThanOrEqual(1);
  });
});

describe("parseColor — format auto-detection", () => {
  test("hex → format hex", () => {
    expect(parseColor("#5b5bd6")).toEqual({ rgb: { r: 91, g: 91, b: 214 }, format: "hex" });
  });
  test("rgb() (space or comma) → format rgb", () => {
    expect(parseColor("rgb(91 91 214)")?.format).toBe("rgb");
    expect(parseColor("rgb(91, 91, 214)")).toEqual({
      rgb: { r: 91, g: 91, b: 214 },
      format: "rgb",
    });
  });
  test("oklch() → format oklch", () => {
    const p = parseColor("oklch(0.5 0.18 280)")!;
    expect(p.format).toBe("oklch");
    expect(p.rgb.r).toBeGreaterThanOrEqual(0);
  });
  test("oklch with % lightness", () => {
    expect(parseColor("oklch(50% 0.1 200)")?.format).toBe("oklch");
  });
  test("unrecognized → null", () => {
    expect(parseColor("hsl(1,2,3)")).toBeNull();
    expect(parseColor("blue")).toBeNull();
  });
});
