// Chrome theming tokens — the source of truth for the editor's two-surface model.
// These --rime-* custom properties theme the CHROME (palette, panels,
// toolbars in the Lit shadow DOM) and intentionally pierce shadow boundaries when
// set on the host or any ancestor.
//
// They MUST NOT be relied on inside the canvas iframe: the email preview is a
// separate surface styled only by its injected base stylesheet, walled off from
// both host CSS and this chrome theme (proven by e2e/theming.spec.ts). Chrome
// components read each token with a fallback — never hard-code the themed value:
//   color: var(--rime-color-accent, #5b5bd6)

export const RIME_TOKENS = {
  "--rime-color-accent": "#5b5bd6",
  "--rime-color-fg": "#18181b",
  "--rime-color-bg": "#ffffff",
  "--rime-color-border": "#e4e4e7",
  "--rime-radius": "8px",
  "--rime-space": "12px",
  "--rime-font-ui": "system-ui, sans-serif",
  "--rime-palette-width": "240px",
  "--rime-properties-width": "300px",
} as const;

export type RimeToken = keyof typeof RIME_TOKENS;

/** A theme override map (subset of the catalogue). */
export type RimeTheme = Partial<Record<RimeToken, string>>;
