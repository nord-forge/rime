// @enveloppe/doc-model — headless JSON document model (the single source of truth).
// See PRD §6.1 and board ENV-10..ENV-14.
//
// ENV-10: schema (types), validation, factory helpers, portable rich-text shape.
// ENV-11/12/14 add the immutable patch engine, undo/redo, and serialize/load.

export * from "./types";
export * from "./rich-text";
export * from "./factory";
export { validateDoc, type ValidateResult, type ValidationError } from "./validate";
export {
  applyPatch,
  getAtPath,
  invertPatch,
  PatchError,
  type Patch,
  type PatchOp,
  type Path,
} from "./patch";
export {
  insertNode,
  moveNode,
  type OpResult,
  OperationError,
  removeNode,
  setRichText,
  updateNode,
} from "./operations";
