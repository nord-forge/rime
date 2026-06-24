# Raw-table fallback (OD-5)

Most blocks export as MJML and inherit its Outlook-safe scaffolding. Some blocks —
especially custom ones — can't be expressed in MJML. For those, a block can opt
out of MJML for **itself only** and supply hand-authored, Outlook-safe table HTML
that is spliced verbatim into the compiled output via MJML's `<mj-raw>`.

This is a per-block escape hatch, not a second renderer. A raw block is an
ordinary `BlockRenderer` registered through the same path as the built-ins.

## Worked example

A custom "coupon" leaf block that renders as a raw table:

```ts
import { MjmlRenderer, createRawBlockRenderer } from "@nord-forge/rime-mjml";

const couponRenderer = createRawBlockRenderer("coupon", (node) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="border:2px dashed #888; padding:16px; font-family:Arial;">
        ${/* author is responsible for escaping + Outlook-safety */ ""}
        Use code <strong>${node.code}</strong>
      </td>
    </tr>
  </table>
`);

const renderer = new MjmlRenderer({ blockRenderers: [couponRenderer] });
const html = await renderer.render(doc);
```

The authored HTML appears in the compiled output unchanged.

## Rules

- **You own Outlook-safety.** The HTML you return is passed through untouched —
  use tables, inline styles, and `<!--[if mso]>` conditionals as needed. MJML
  does not normalize it.
- **You own escaping.** Interpolated values (`node.code` above) are not escaped
  for you. Escape anything user-controlled.
- **Leaf blocks only.** Raw fallback is allowed for leaf block types
  (text/image/button/divider/spacer and custom leaves). It is **rejected** for
  the structural container types `document`, `section`, and `column` — those own
  their MJML wrappers and their children depend on them. `createRawBlockRenderer`
  throws a `RenderError` if you try.
- **Override or add.** Passing a raw renderer for an existing type (e.g.
  `"button"`) overrides the built-in MJML mapping for that type; passing a new
  type adds a handler. Same registration path either way.
