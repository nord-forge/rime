import { describe, expect, test } from "bun:test";
import { DropDetector, type Scheduler } from "./drop-detector";
import type { DropTarget } from "../dnd-types/dnd-types";

/** A manual scheduler: collect callbacks, flush them on demand (fake rAF). */
function fakeScheduler() {
  const queue: (() => void)[] = [];
  let id = 0;
  const scheduler: Scheduler = {
    request: (cb) => {
      queue.push(cb);
      return ++id;
    },
    cancel: () => {
      queue.length = 0;
    },
  };
  return { scheduler, flush: () => queue.splice(0).forEach((cb) => cb()) };
}

describe("DropDetector rAF coalescing", () => {
  test("N synchronous moves → one resolve per frame", () => {
    const { scheduler, flush } = fakeScheduler();
    let resolves = 0;
    const results: (DropTarget | null)[] = [];
    const det = new DropDetector(
      (p) => {
        resolves += 1;
        return { parentId: "c", index: p.x };
      },
      (t) => results.push(t),
      scheduler,
    );

    det.onMove({ x: 1, y: 0 });
    det.onMove({ x: 2, y: 0 });
    det.onMove({ x: 3, y: 0 }); // 3 moves, no frame yet
    expect(resolves).toBe(0);

    flush();
    expect(resolves).toBe(1); // exactly one hit-test
    expect(results).toEqual([{ parentId: "c", index: 3 }]); // for the LATEST point
  });

  test("each frame allows one more resolve", () => {
    const { scheduler, flush } = fakeScheduler();
    let resolves = 0;
    const det = new DropDetector(
      () => {
        resolves += 1;
        return null;
      },
      () => {},
      scheduler,
    );
    det.onMove({ x: 1, y: 1 });
    flush();
    det.onMove({ x: 2, y: 2 });
    flush();
    expect(resolves).toBe(2);
  });

  test("cancel() prevents a pending flush", () => {
    const { scheduler, flush } = fakeScheduler();
    let resolves = 0;
    const det = new DropDetector(
      () => {
        resolves += 1;
        return null;
      },
      () => {},
      scheduler,
    );
    det.onMove({ x: 1, y: 1 });
    det.cancel();
    flush();
    expect(resolves).toBe(0);
  });
});
