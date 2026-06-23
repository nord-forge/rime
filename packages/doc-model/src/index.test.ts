import { expect, test } from "bun:test";
import { PLACEHOLDER } from "./index.ts";

// Smoke test so `bun test` finds at least one file and the harness is wired.
// Real schema/patch/serialize tests arrive with ENV-10/11/14.
test("doc-model package is importable", () => {
  expect(PLACEHOLDER).toBe(true);
});
