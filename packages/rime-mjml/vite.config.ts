import { libConfig } from "../../scripts/vite-lib.ts";

// renderer-mjml runs at export time, Node-side. Build for Node and keep `mjml`
// an external runtime dependency (the consumer installs it) rather than bundling
// its large tree into this package.
export default libConfig({
  root: import.meta.dirname,
  node: true,
  external: ["mjml", /^mjml\//],
});
