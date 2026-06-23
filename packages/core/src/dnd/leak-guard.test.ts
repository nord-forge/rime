import { beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import {
  createButtonBlock,
  createEmptyDoc,
  createSection,
  createTextBlock,
  type DocumentNode,
  insertNode,
  moveNode,
} from "@enveloppe/doc-model";
import { CanvasRenderer } from "../canvas/canvas-renderer";
import { DragCoordinateController } from "../canvas/coordinate-controller";
import { CleanupRegistry } from "./cleanup-registry";
import { DndController } from "./dnd-controller";

describe("CleanupRegistry", () => {
  test("counts, disposer removes one, disposeAll clears", () => {
    const reg = new CleanupRegistry();
    let ran = 0;
    const d1 = reg.add(() => (ran += 1));
    reg.add(() => (ran += 1));
    expect(reg.size).toBe(2);
    d1();
    expect(reg.size).toBe(1);
    expect(ran).toBe(1);
    d1(); // idempotent
    expect(reg.size).toBe(1);
    reg.disposeAll();
    expect(reg.size).toBe(0);
    expect(ran).toBe(2);
  });
});

// A synchronous scheduler so the drag's detector work runs without real rAF.
const syncScheduler = { request: (cb: () => void) => (cb(), 1), cancel: () => {} };

function ids() {
  let n = 0;
  return (prefix = "n") => `${prefix}_${(n += 1)}`;
}

function buildDoc(): DocumentNode {
  const newId = ids();
  const doc = createEmptyDoc(newId);
  const section = createSection(newId, 1);
  section.children[0]!.children.push(createTextBlock(newId), createButtonBlock(newId));
  doc.children.push(section);
  return doc;
}

describe("DndController leak guard", () => {
  let win: Window;
  let cdoc: Document;
  let mount: HTMLElement;

  beforeEach(() => {
    win = new Window();
    cdoc = win.document as unknown as Document;
    mount = cdoc.createElement("div");
    cdoc.body.append(mount);
  });

  function makeController(doc: DocumentNode) {
    let current = doc;
    const renderer = new CanvasRenderer(mount, cdoc);
    renderer.render(current);
    const coords = new DragCoordinateController({
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 600, height: 800 }),
      contentWindow: { scrollX: 0, scrollY: 0 },
      contentDocument: cdoc,
    });
    const controller = new DndController({
      canvasDocument: cdoc,
      hostWindow: win as unknown as Window,
      coords,
      renderer,
      overlayHost: cdoc.body as unknown as ParentNode & { ownerDocument: Document },
      getDoc: () => current,
      createBlock: (t) => createButtonBlock(() => `new_${t}`),
      dispatch: (op) => {
        current = op.doc as DocumentNode;
        renderer.update(current);
        controller.syncCanvasTargets();
      },
      ops: { insertNode, moveNode },
      scheduler: syncScheduler,
    });
    return { controller, renderer, getDoc: () => current };
  }

  /** Simulate a full drag of an existing block via dispatched pointer events. */
  function simulateDrag(targetNodeId: string, toY: number): void {
    const el = mount.querySelector(`[data-node-id="${targetNodeId}"]`)!;
    el.dispatchEvent(
      new win.PointerEvent("pointerdown", { clientX: 10, clientY: 10, bubbles: true }),
    );
    cdoc.dispatchEvent(
      new win.PointerEvent("pointermove", { clientX: 14, clientY: 14, bubbles: true }),
    );
    cdoc.dispatchEvent(
      new win.PointerEvent("pointermove", { clientX: 20, clientY: toY, bubbles: true }),
    );
    cdoc.dispatchEvent(
      new win.PointerEvent("pointerup", { clientX: 20, clientY: toY, bubbles: true }),
    );
  }

  test("cleanup count returns to baseline after each drag and never grows", () => {
    const doc = buildDoc();
    const { controller, getDoc } = makeController(doc);
    const baseline = controller.activeCleanupCount; // idle: 0 transient cleanups
    expect(baseline).toBe(0);

    for (let i = 0; i < 5; i += 1) {
      const firstLeaf = getDoc().children[0]!.children[0]!.children[0]!.id;
      simulateDrag(firstLeaf, 400);
      expect(controller.activeCleanupCount).toBe(baseline); // disposed after drop
    }
  });

  test("mid-drag registers transient cleanups; all disposed at drop (add==remove)", () => {
    const { controller, getDoc } = makeController(buildDoc());
    const leaf = getDoc().children[0]!.children[0]!.children[0]!.id;
    const el = mount.querySelector(`[data-node-id="${leaf}"]`)!;

    // Mid-drag: the 4 pointer listeners + rAF detector are live.
    el.dispatchEvent(
      new win.PointerEvent("pointerdown", { clientX: 10, clientY: 10, bubbles: true }),
    );
    cdoc.dispatchEvent(
      new win.PointerEvent("pointermove", { clientX: 20, clientY: 80, bubbles: true }),
    );
    const mid = controller.activeCleanupCount;
    expect(mid).toBeGreaterThanOrEqual(5); // 4 listeners + detector (+ preview)

    // On drop, every transient cleanup is disposed (added == removed ⇒ 0 live).
    cdoc.dispatchEvent(
      new win.PointerEvent("pointerup", { clientX: 20, clientY: 400, bubbles: true }),
    );
    expect(controller.activeCleanupCount).toBe(0);
  });

  test("destroy() disposes everything (count → 0)", () => {
    const { controller, getDoc } = makeController(buildDoc());
    // Start a drag but DON'T finish it, then destroy mid-drag.
    const leaf = getDoc().children[0]!.children[0]!.children[0]!.id;
    const el = mount.querySelector(`[data-node-id="${leaf}"]`)!;
    el.dispatchEvent(
      new win.PointerEvent("pointerdown", { clientX: 10, clientY: 10, bubbles: true }),
    );
    cdoc.dispatchEvent(
      new win.PointerEvent("pointermove", { clientX: 20, clientY: 80, bubbles: true }),
    );
    expect(controller.activeCleanupCount).toBeGreaterThan(0); // mid-drag: live cleanups
    controller.destroy();
    expect(controller.activeCleanupCount).toBe(0);
  });
});
