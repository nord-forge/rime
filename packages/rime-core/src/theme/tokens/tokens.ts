// Chrome theming tokens — the source of truth for the editor's two-surface model.
// These --eb-* custom properties theme the CHROME (palette, panels,
// toolbars in the Lit shadow DOM) and intentionally pierce shadow boundaries when
// set on the host or any ancestor.
//
// They MUST NOT be relied on inside the canvas iframe: the email preview is a
// separate surface styled only by its injected base stylesheet, walled off from
// both host CSS and this chrome theme (proven by e2e/theming.spec.ts). Chrome
// components read each token with a fallback — never hard-code the themed value:
//   color: var(--eb-color-accent, #5b5bd6)

export const EB_TOKENS = {
  "--eb-color-accent": "#5b5bd6",
  "--eb-color-fg": "#18181b",
  "--eb-color-bg": "#ffffff",
  "--eb-color-border": "#e4e4e7",
  "--eb-radius": "8px",
  "--eb-space": "12px",
  "--eb-font-ui": "system-ui, sans-serif",
  "--eb-palette-width": "240px",
  "--eb-properties-width": "300px",
} as const;

export type EbToken = keyof typeof EB_TOKENS;

/** A theme override map (subset of the catalogue). */
export type EbTheme = Partial<Record<EbToken, string>>;
