import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { LiveAnnouncer } from "./live-region";

function host(): ParentNode & { ownerDocument: Document } {
  const doc = new Window().document as unknown as Document;
  return doc.body as unknown as ParentNode & { ownerDocument: Document };
}

describe("LiveAnnouncer", () => {
  test("creates a polite, atomic, visually-hidden region (not display:none)", () => {
    const h = host();
    new LiveAnnouncer(h);
    const region = (h as unknown as HTMLElement).querySelector("[aria-live]") as HTMLElement;
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.getAttribute("aria-atomic")).toBe("true");
    const css = region.getAttribute("style") ?? "";
    expect(css).not.toContain("display:none");
    expect(css).not.toContain("display: none");
    expect(css).toContain("clip");
  });

  test("announce sets the region text (clear-then-set)", async () => {
    const announcer = new LiveAnnouncer(host());
    announcer.announce("Hello");
    await new Promise((r) => setTimeout(r, 5));
    expect(announcer.current).toBe("Hello");
  });

  test("re-announcing an identical message clears then re-sets it", async () => {
    const announcer = new LiveAnnouncer(host());
    announcer.announce("Same");
    await new Promise((r) => setTimeout(r, 5));
    expect(announcer.current).toBe("Same");
    announcer.announce("Same");
    expect(announcer.current).toBe(""); // cleared synchronously
    await new Promise((r) => setTimeout(r, 5));
    expect(announcer.current).toBe("Same"); // re-set
  });

  test("destroy removes the region", () => {
    const h = host();
    const announcer = new LiveAnnouncer(h);
    announcer.destroy();
    expect((h as unknown as HTMLElement).querySelector("[aria-live]")).toBeNull();
  });
});
