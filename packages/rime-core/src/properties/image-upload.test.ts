import { describe, expect, test } from "bun:test";
import { resolveUpload } from "./image-upload";

const file = new File(["x"], "pic.png", { type: "image/png" });

describe("resolveUpload", () => {
  test("calls the host uploader and returns the trimmed URL to store", async () => {
    let received: File | null = null;
    const out = await resolveUpload(async (f) => {
      received = f;
      return "  https://cdn.test/pic.png  ";
    }, file);
    expect(received).toBe(file);
    expect(out).toEqual({ kind: "url", url: "https://cdn.test/pic.png" });
  });

  test("an empty/whitespace return is a no-op (keep previous src)", async () => {
    expect(await resolveUpload(async () => "", file)).toEqual({ kind: "none" });
    expect(await resolveUpload(async () => "   ", file)).toEqual({ kind: "none" });
  });

  test("a rejected upload becomes an error (previous src preserved by caller)", async () => {
    const out = await resolveUpload(async () => {
      throw new Error("network down");
    }, file);
    expect(out.kind).toBe("error");
    if (out.kind === "error") expect(out.message).toMatch(/failed/i);
  });

  test("no uploader configured is a no-op (the library never uploads itself)", async () => {
    expect(await resolveUpload(undefined, file)).toEqual({ kind: "none" });
  });
});
