import { libConfig } from "../../scripts/vite-lib.ts";

export default libConfig({
  root: import.meta.dirname,
  entries: { register: "src/register.ts", richtext: "src/richtext.ts" },
});
