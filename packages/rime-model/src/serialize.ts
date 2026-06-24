// The save/load boundary. Persistence is headless: the library emits/accepts a
// versioned JSON envelope and the host owns storage (PRD §6.10). Losslessness is
// the core guarantee — deserialize(serialize(doc)) deep-equals doc — because doc
// nodes are plain serializable data (the schema forbids functions). On load we always
// re-validate via the schema validator and never throw.

import type { RimeDoc } from "./types";
import { validateDoc, type ValidationError } from "./validate";

/** Bump when the on-disk shape changes; deserialize migrates older versions forward. */
export const SCHEMA_VERSION = 1;

/** The persisted wrapper around a document. */
export interface DocEnvelope {
  version: number;
  doc: RimeDoc;
}

/** Options for `serialize`. */
export interface SerializeOptions {
  /** Pretty-print with 2-space indent (debug only; does not affect round-trip). */
  pretty?: boolean;
}

/** Serialize a doc into a stable, versioned string (compact by default). */
export function serialize(doc: RimeDoc, options: SerializeOptions = {}): string {
  const envelope: DocEnvelope = { version: SCHEMA_VERSION, doc };
  return options.pretty ? JSON.stringify(envelope, null, 2) : JSON.stringify(envelope);
}

export type DeserializeResult =
  | { ok: true; doc: RimeDoc; version: number }
  | { ok: false; errors: ValidationError[] };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Migrate a parsed doc from its stored `version` up to SCHEMA_VERSION.
 *
 * v1 is the first version, so there are no prior shapes to upgrade yet. To add a
 * future migration, append a step that transforms version N → N+1 and run them in
 * order — e.g. `if (version < 2) { doc = upgrade1to2(doc); version = 2; }`. Keeping
 * the steps here makes adding one a localized change.
 */
function migrate(_version: number, doc: unknown): unknown {
  // Future steps slot in here, each transforming one version forward, e.g.:
  //   let current = doc;
  //   if (_version < 2) current = upgrade1to2(current);
  //   return current;
  // For v1 there is nothing to upgrade.
  return doc;
}

/** Parse → migrate → validate. Returns errors instead of throwing on bad input. */
export function deserialize(input: string): DeserializeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [{ path: "", message: `invalid JSON: ${message}` }] };
  }

  if (!isObject(parsed)) {
    return { ok: false, errors: [{ path: "", message: "envelope must be an object" }] };
  }

  const version = parsed["version"];
  if (typeof version !== "number" || !Number.isFinite(version)) {
    return { ok: false, errors: [{ path: "version", message: "version must be a number" }] };
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      errors: [
        {
          path: "version",
          message: `unsupported version ${version} (this build supports up to ${SCHEMA_VERSION})`,
        },
      ],
    };
  }
  if (version < 1) {
    return { ok: false, errors: [{ path: "version", message: `invalid version ${version}` }] };
  }

  if (!isObject(parsed["doc"])) {
    return { ok: false, errors: [{ path: "doc", message: "doc must be an object" }] };
  }

  const migrated = migrate(version, parsed["doc"]);
  const result = validateDoc(migrated);
  if (!result.ok) return { ok: false, errors: result.errors };

  return { ok: true, doc: result.doc, version: SCHEMA_VERSION };
}
