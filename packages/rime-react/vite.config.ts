import { libConfig } from "../../scripts/vite-lib.ts";

export default libConfig({
  root: import.meta.dirname,
  external: ["react", "react-dom", /^react\//, /^react-dom\//],
});
