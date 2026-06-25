import { libConfig } from "../../scripts/vite-lib.ts";

// renderer-mjml runs at export time, Node-side. Build for Node and keep `mjml`
// an external runtime dependency (the consumer installs it) rather than bundling
// its large tree into this package.
export default libConfig({
  root: import.meta.dirname,
  node: true,
  external: ["mjml", /^mjml\//],
  // ./browser is the Node-free subset (docToMjml + helpers, no MjmlRenderer) so a
  // browser app can produce the portable MJML without bundling the Node `mjml` lib.
  entries: { browser: "src/browser.ts" },
});
