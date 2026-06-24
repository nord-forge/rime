// Minimal, dependency-free patch format + an immutable applier that uses
// structural sharing (only nodes on the changed path are cloned; siblings keep
// their original references). Patches — not snapshots — are what undo/redo stores.

import type { RimeDoc } from "./types";

/** Structural path from the document root, e.g. ["children", 0, "children", 2]. */
export type Path = (string | number)[];

export type PatchOp =
  | { op: "set"; path: Path; value: unknown }
  | { op: "insert"; path: Path; index: number; value: unknown }
  | { op: "remove"; path: Path; index: number }
  | { op: "move"; from: Path; fromIndex: number; to: Path; toIndex: number };

export type Patch = PatchOp[];

/** Error thrown when a patch references a path that doesn't exist / is wrong-typed. */
export class PatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PatchError";
  }
}

type Json = unknown;

function isIndex(key: string | number): key is number {
  return typeof key === "number";
}

/** Read the value at `path` within `root` (no cloning). */
export function getAtPath(root: Json, path: Path): Json {
  let current: Json = root;
  for (const key of path) {
    if (current == null || typeof current !== "object") {
      throw new PatchError(`path ${JSON.stringify(path)} traverses a non-object`);
    }
    current = (current as Record<string | number, Json>)[key];
  }
  return current;
}

/**
 * Return a copy of `root` with `value` placed at `path`, cloning only the nodes
 * along `path` (structural sharing). An empty path replaces the whole root.
 */
function setAtPath(root: Json, path: Path, value: Json): Json {
  if (path.length === 0) return value;

  const [key, ...rest] = path as [string | number, ...Path];
  if (root == null || typeof root !== "object") {
    throw new PatchError(`cannot set into a non-object at ${JSON.stringify(path)}`);
  }

  if (Array.isArray(root)) {
    if (!isIndex(key)) throw new PatchError(`array index expected, got "${String(key)}"`);
    const next = root.slice();
    next[key] = rest.length === 0 ? value : setAtPath(root[key], rest, value);
    return next;
  }

  const obj = root as Record<string | number, Json>;
  const next: Record<string | number, Json> = { ...obj };
  next[key] = rest.length === 0 ? value : setAtPath(obj[key], rest, value);
  return next;
}

/** Resolve the array living at `path`, throwing if it is not an array. */
function getArrayAtPath(root: Json, path: Path): Json[] {
  const target = getAtPath(root, path);
  if (!Array.isArray(target)) {
    throw new PatchError(`expected an array at ${JSON.stringify(path)}`);
  }
  return target;
}

/** Apply one op immutably, returning a new root. */
function applyOp(root: Json, op: PatchOp): Json {
  switch (op.op) {
    case "set":
      return setAtPath(root, op.path, op.value);

    case "insert": {
      const arr = getArrayAtPath(root, op.path);
      if (op.index < 0 || op.index > arr.length) {
        throw new PatchError(`insert index ${op.index} out of range at ${JSON.stringify(op.path)}`);
      }
      const next = arr.slice();
      next.splice(op.index, 0, op.value);
      return setAtPath(root, op.path, next);
    }

    case "remove": {
      const arr = getArrayAtPath(root, op.path);
      if (op.index < 0 || op.index >= arr.length) {
        throw new PatchError(`remove index ${op.index} out of range at ${JSON.stringify(op.path)}`);
      }
      const next = arr.slice();
      next.splice(op.index, 1);
      return setAtPath(root, op.path, next);
    }

    case "move": {
      // Remove from source, then insert into target. Read the value first.
      const fromArr = getArrayAtPath(root, op.from);
      if (op.fromIndex < 0 || op.fromIndex >= fromArr.length) {
        throw new PatchError(`move fromIndex ${op.fromIndex} out of range`);
      }
      const moved = fromArr[op.fromIndex];
      let next = applyOp(root, { op: "remove", path: op.from, index: op.fromIndex });
      next = applyOp(next, { op: "insert", path: op.to, index: op.toIndex, value: moved });
      return next;
    }
  }
}

/** Apply a patch immutably; the input doc is never mutated. */
export function applyPatch(doc: RimeDoc, patch: Patch): RimeDoc {
  let current: Json = doc;
  for (const op of patch) current = applyOp(current, op);
  return current as RimeDoc;
}

/**
 * Compute the inverse of `patch` *relative to `doc`* (the state BEFORE the patch
 * is applied). Applying the inverse to the patched doc restores `doc`.
 *
 * Ops are inverted in reverse order, each against the document state it would
 * actually see when the forward patch is replayed up to that point.
 */
export function invertPatch(doc: RimeDoc, patch: Patch): Patch {
  // Reconstruct the intermediate states so each op is inverted against its own
  // "before" snapshot. states[i] is the doc state just before patch[i].
  const states: Json[] = [doc];
  let current: Json = doc;
  for (const op of patch) {
    current = applyOp(current, op);
    states.push(current);
  }

  const inverse: Patch = [];
  for (let i = patch.length - 1; i >= 0; i -= 1) {
    const op = patch[i]!;
    const before = states[i]!;
    inverse.push(invertOp(before, op));
  }
  return inverse;
}

function invertOp(before: Json, op: PatchOp): PatchOp {
  switch (op.op) {
    case "set": {
      const prev = getAtPath(before, op.path);
      return { op: "set", path: op.path, value: prev };
    }
    case "insert":
      // undo an insert by removing what was inserted
      return { op: "remove", path: op.path, index: op.index };
    case "remove": {
      const arr = getArrayAtPath(before, op.path);
      const removed = arr[op.index];
      return { op: "insert", path: op.path, index: op.index, value: removed };
    }
    case "move":
      // reverse the move: target → source
      return {
        op: "move",
        from: op.to,
        fromIndex: op.toIndex,
        to: op.from,
        toIndex: op.fromIndex,
      };
  }
}
