// rAF-gated drop detection (PRD §6.6: detection must be throttled /
// requestAnimationFrame-disciplined). A burst of pointer moves collapses to one
// hit-test per frame: onMove() does O(1) work (stash the latest point + schedule
// a frame); all rect-math runs in flush(). The scheduler is injectable so the
// coalescing is unit-testable with a fake rAF.

import type { Point } from "../../canvas/coordinate-controller/coordinate-controller";
import type { DropTarget } from "../dnd-types/dnd-types";

export interface Scheduler {
  request(cb: () => void): number;
  cancel(handle: number): void;
}

const defaultScheduler: Scheduler = {
  request: (cb) => requestAnimationFrame(cb),
  cancel: (h) => cancelAnimationFrame(h),
};

export class DropDetector {
  readonly #resolve: (p: Point) => DropTarget | null;
  readonly #onResult: (target: DropTarget | null, point: Point) => void;
  readonly #scheduler: Scheduler;
  #pending: Point | null = null;
  #frame = 0;

  constructor(
    resolve: (p: Point) => DropTarget | null,
    onResult: (target: DropTarget | null, point: Point) => void,
    scheduler: Scheduler = defaultScheduler,
  ) {
    this.#resolve = resolve;
    this.#onResult = onResult;
    this.#scheduler = scheduler;
  }

  /** Cheap: stash the latest point and schedule a frame. Never hit-tests here. */
  onMove(point: Point): void {
    this.#pending = point;
    if (!this.#frame) {
      this.#frame = this.#scheduler.request(() => this.#flush());
    }
  }

  #flush(): void {
    this.#frame = 0;
    const point = this.#pending;
    this.#pending = null;
    if (point) this.#onResult(this.#resolve(point), point);
  }

  /** Cancel any pending frame (drag end / destroy). */
  cancel(): void {
    if (this.#frame) this.#scheduler.cancel(this.#frame);
    this.#frame = 0;
    this.#pending = null;
  }
}
