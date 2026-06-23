import { describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  type CanvasFrameLike,
  DragCoordinateController,
  type Point,
} from "./coordinate-controller";

/** A fake iframe with controllable rect + scroll + a happy-dom contentDocument. */
function fakeFrame(opts: {
  rect: { left: number; top: number; width: number; height: number };
  scrollX?: number;
  scrollY?: number;
  doc?: Document;
}): CanvasFrameLike {
  return {
    getBoundingClientRect: () => opts.rect,
    contentWindow: { scrollX: opts.scrollX ?? 0, scrollY: opts.scrollY ?? 0 },
    contentDocument: opts.doc ?? null,
  };
}

describe("coordinate translation", () => {
  test("hostToCanvas subtracts iframe origin and adds canvas scroll", () => {
    const c = new DragCoordinateController(
      fakeFrame({
        rect: { left: 100, top: 50, width: 600, height: 800 },
        scrollX: 10,
        scrollY: 20,
      }),
    );
    // host (150,120) → client (50,70) → doc (60,90)
    expect(c.hostToCanvas({ x: 150, y: 120 })).toEqual({ x: 60, y: 90 });
  });

  test("hostToCanvas / canvasToHost are exact inverses (incl. scroll)", () => {
    const c = new DragCoordinateController(
      fakeFrame({ rect: { left: 33, top: 77, width: 600, height: 800 }, scrollX: 15, scrollY: 40 }),
    );
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 300 },
      { x: 33, y: 77 },
    ];
    for (const p of points) {
      const round = c.canvasToHost(c.hostToCanvas(p));
      expect(round.x).toBeCloseTo(p.x, 6);
      expect(round.y).toBeCloseTo(p.y, 6);
    }
  });
});

describe("isOverCanvas", () => {
  test("reports inside vs outside the canvas viewport", () => {
    const c = new DragCoordinateController(
      fakeFrame({ rect: { left: 100, top: 100, width: 200, height: 200 } }),
    );
    expect(c.isOverCanvas({ x: 150, y: 150 })).toBe(true);
    expect(c.isOverCanvas({ x: 100, y: 100 })).toBe(true); // edge
    expect(c.isOverCanvas({ x: 99, y: 150 })).toBe(false);
    expect(c.isOverCanvas({ x: 350, y: 150 })).toBe(false);
  });
});

describe("nodeIdAtHostPoint", () => {
  test("translates a host point and resolves it to the node id (with scroll)", () => {
    const win = new Window();
    const doc = win.document as unknown as Document;
    // Stub elementFromPoint: the controller must pass iframe CLIENT (pre-scroll)
    // coords. Assert that, and return a node-stamped element.
    const target = doc.createElement("span");
    const block = doc.createElement("div");
    block.dataset["nodeId"] = "blk_1";
    block.append(target);
    doc.body.append(block);

    let seen: Point | null = null;
    (
      doc as unknown as { elementFromPoint: (x: number, y: number) => Element | null }
    ).elementFromPoint = (x, y) => {
      seen = { x, y };
      return target;
    };

    const c = new DragCoordinateController(
      fakeFrame({
        rect: { left: 100, top: 50, width: 600, height: 800 },
        scrollX: 10,
        scrollY: 20,
        doc,
      }),
    );

    const id = c.nodeIdAtHostPoint({ x: 150, y: 120 });
    expect(id).toBe("blk_1");
    // client coords are pre-scroll: (150-100, 120-50) = (50, 70), NOT doc coords.
    expect(seen).toEqual({ x: 50, y: 70 });
  });

  test("returns null when no node-stamped ancestor", () => {
    const win = new Window();
    const doc = win.document as unknown as Document;
    const loose = doc.createElement("div");
    doc.body.append(loose);
    (doc as unknown as { elementFromPoint: () => Element | null }).elementFromPoint = () => loose;

    const c = new DragCoordinateController(
      fakeFrame({ rect: { left: 0, top: 0, width: 100, height: 100 }, doc }),
    );
    expect(c.nodeIdAtHostPoint({ x: 5, y: 5 })).toBeNull();
  });

  test("returns null without a contentDocument", () => {
    const c = new DragCoordinateController(
      fakeFrame({ rect: { left: 0, top: 0, width: 10, height: 10 } }),
    );
    expect(c.nodeIdAtHostPoint({ x: 1, y: 1 })).toBeNull();
  });
});

describe("invalidate", () => {
  test("re-reads the iframe rect after it changes", () => {
    let left = 0;
    const frame: CanvasFrameLike = {
      getBoundingClientRect: () => ({ left, top: 0, width: 100, height: 100 }),
      contentWindow: { scrollX: 0, scrollY: 0 },
      contentDocument: null,
    };
    const c = new DragCoordinateController(frame);
    expect(c.hostToCanvas({ x: 50, y: 0 }).x).toBe(50); // rect.left = 0 (cached)

    left = 30; // iframe moved (e.g. resize/scroll)
    expect(c.hostToCanvas({ x: 50, y: 0 }).x).toBe(50); // still cached
    c.invalidate();
    expect(c.hostToCanvas({ x: 50, y: 0 }).x).toBe(20); // 50 - 30
  });
});
