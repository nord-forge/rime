// Inline SVG palette icons. Hand-inlined from Lucide (https://lucide.dev, ISC/MIT)
// so we carry NO icon-package dependency — these are plain strings the palette
// renders as trusted markup (they are static, author-controlled, never user input).
//
// Each icon is a 24×24 stroke SVG sized by the .icon container; `currentColor` lets
// it inherit the themed chrome foreground. Keep them visually consistent (1.8 stroke,
// round caps) so the palette reads as one set.

const svg = (paths: string): string =>
  `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" ` +
  `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">` +
  `${paths}</svg>`;

// ── Layout ──────────────────────────────────────────────────────────────────
export const ICON_SECTION = svg('<rect x="3" y="5" width="18" height="14" rx="2"/>');
export const ICON_DIVIDER = svg('<line x1="4" y1="12" x2="20" y2="12"/>');
export const ICON_SPACER = svg(
  '<path d="M12 3v18"/><path d="m8 7 4-4 4 4"/><path d="m8 17 4 4 4-4"/>',
);
export const ICON_COLUMN = svg('<rect x="9" y="3" width="6" height="18" rx="1"/>');

export const ICON_COLS_2 = svg(
  '<rect x="3" y="4" width="7.5" height="16" rx="1"/><rect x="13.5" y="4" width="7.5" height="16" rx="1"/>',
);
export const ICON_COLS_3 = svg(
  '<rect x="3" y="4" width="4.8" height="16" rx="1"/>' +
    '<rect x="9.6" y="4" width="4.8" height="16" rx="1"/>' +
    '<rect x="16.2" y="4" width="4.8" height="16" rx="1"/>',
);
export const ICON_SIDEBAR = svg(
  '<rect x="3" y="4" width="6" height="16" rx="1"/><rect x="11" y="4" width="10" height="16" rx="1"/>',
);
export const ICON_IMAGE_TEXT = svg(
  '<rect x="3" y="5" width="8" height="14" rx="1"/>' +
    '<circle cx="6" cy="9" r="1.3"/><path d="m3.5 16 2.5-2.5 2 2"/>' +
    '<line x1="14" y1="8" x2="21" y2="8"/><line x1="14" y1="12" x2="21" y2="12"/><line x1="14" y1="16" x2="19" y2="16"/>',
);

// ── Content ─────────────────────────────────────────────────────────────────
export const ICON_TEXT = svg('<path d="M4 7V5h16v2"/><path d="M9 19h6"/><path d="M12 5v14"/>');
export const ICON_HEADING = svg(
  '<path d="M6 4v16"/><path d="M18 4v16"/><path d="M6 12h12"/><path d="M2 4h2"/><path d="M2 20h2"/>',
);
export const ICON_IMAGE = svg(
  '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
    '<circle cx="8.5" cy="9.5" r="1.5"/><path d="m4 17 4.5-4.5L13 17"/><path d="m14 14 2-2 4 4"/>',
);
export const ICON_BUTTON = svg(
  '<rect x="3" y="8" width="18" height="8" rx="4"/><line x1="8" y1="12" x2="16" y2="12"/>',
);
export const ICON_QUOTE = svg(
  '<path d="M7 7C5 7 4 8.5 4 11v6h6v-6H6.5C6.5 9 7 8 8 8z"/>' +
    '<path d="M17 7c-2 0-3 1.5-3 4v6h6v-6h-3.5c0-2 .5-3 1.5-3z"/>',
);
export const ICON_SOCIAL = svg(
  '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5"/>' +
    '<path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5"/>',
);
export const ICON_HERO = svg(
  '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
    '<path d="m4 16 5-5 4 4 3-3 4 4"/><circle cx="16" cy="9" r="1.3"/>',
);
export const ICON_MENU = svg(
  '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
);
export const ICON_VIDEO = svg(
  '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none"/>',
);
export const ICON_TABLE = svg(
  '<rect x="3" y="4" width="18" height="16" rx="2"/>' +
    '<line x1="3" y1="10" x2="21" y2="10"/><line x1="3" y1="15" x2="21" y2="15"/>' +
    '<line x1="9" y1="4" x2="9" y2="20"/><line x1="15" y1="4" x2="15" y2="20"/>',
);

// ── Advanced ────────────────────────────────────────────────────────────────
export const ICON_HTML = svg('<path d="m9 8-4 4 4 4"/><path d="m15 8 4 4-4 4"/>');
