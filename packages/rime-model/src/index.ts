// @nord-forge/rime-model — headless JSON document model (the single source of truth).
// See PRD §6.1.
//
// This package: schema (types), validation, factory helpers, portable rich-text
// shape, the immutable patch engine, undo/redo, and serialize/load.

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
export { type AppliedOp, History, type HistoryEntry, type HistoryOptions } from "./history";
export {
  deserialize,
  type DeserializeResult,
  type DocEnvelope,
  SCHEMA_VERSION,
  serialize,
  type SerializeOptions,
} from "./serialize";
