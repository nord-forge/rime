// Hand-written validator (no schema library — keeps the package dependency-free
// and tiny, and usable headless/server-side). Walks the tree, enforcing node
// shapes, legal parent→child nesting, unique ids, and column-width sums, and
// reports every problem with a precise JSON-ish `path`.

import { type EnveloppeDoc, LEAF_TYPES } from "./types";
import type { Mark } from "./rich-text";

/** A single validation problem, located by `path`. */
export interface ValidationError {
  /** e.g. `children[0].children[2].widthPercent`. */
  path: string;
  message: string;
}

export type ValidateResult =
  | { ok: true; doc: EnveloppeDoc }
  | { ok: false; errors: ValidationError[] };

const VALID_MARKS = new Set<Mark>(["bold", "italic", "underline"]);
const VALID_ALIGN = new Set(["left", "center", "right"]);
const COLUMN_SUM_TOLERANCE = 1; // ±1% for rounding

/** Validate an unknown value as an EnveloppeDoc. */
export function validateDoc(value: unknown): ValidateResult {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();

  validateDocument(value, "$", errors, seenIds);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, doc: value as EnveloppeDoc };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkId(
  node: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
  seenIds: Set<string>,
): void {
  const id = node["id"];
  if (typeof id !== "string" || id.length === 0) {
    errors.push({ path: `${path}.id`, message: "id must be a non-empty string" });
    return;
  }
  if (seenIds.has(id)) {
    errors.push({ path: `${path}.id`, message: `duplicate id "${id}"` });
    return;
  }
  seenIds.add(id);
}

function checkFiniteNumber(
  value: unknown,
  path: string,
  errors: ValidationError[],
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    errors.push({ path, message: "must be a finite number" });
    return false;
  }
  return true;
}

function checkStyle(value: unknown, path: string, errors: ValidationError[]): void {
  if (value === undefined) return;
  if (!isObject(value)) {
    errors.push({ path, message: "style must be an object" });
    return;
  }
  for (const key of ["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const) {
    if (value[key] !== undefined) checkFiniteNumber(value[key], `${path}.${key}`, errors);
  }
  if (value["align"] !== undefined && !VALID_ALIGN.has(value["align"] as string)) {
    errors.push({ path: `${path}.align`, message: "align must be left|center|right" });
  }
}

function validateDocument(
  value: unknown,
  path: string,
  errors: ValidationError[],
  seenIds: Set<string>,
): void {
  if (!isObject(value)) {
    errors.push({ path, message: "document must be an object" });
    return;
  }
  if (value["type"] !== "document") {
    errors.push({ path: `${path}.type`, message: 'root type must be "document"' });
  }
  checkId(value, path, errors, seenIds);

  const settings = value["settings"];
  if (!isObject(settings)) {
    errors.push({ path: `${path}.settings`, message: "settings must be an object" });
  } else {
    checkFiniteNumber(settings["contentWidth"], `${path}.settings.contentWidth`, errors);
    if (typeof settings["backgroundColor"] !== "string") {
      errors.push({
        path: `${path}.settings.backgroundColor`,
        message: "must be a string",
      });
    }
    if (typeof settings["fontFamily"] !== "string") {
      errors.push({ path: `${path}.settings.fontFamily`, message: "must be a string" });
    }
  }

  const children = value["children"];
  if (!Array.isArray(children)) {
    errors.push({ path: `${path}.children`, message: "children must be an array" });
    return;
  }
  children.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    if (!isObject(child) || child["type"] !== "section") {
      errors.push({ path: childPath, message: "document children must be sections" });
      return;
    }
    validateSection(child, childPath, errors, seenIds);
  });
}

function validateSection(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
  seenIds: Set<string>,
): void {
  checkId(value, path, errors, seenIds);
  checkStyle(value["style"], `${path}.style`, errors);

  const children = value["children"];
  if (!Array.isArray(children)) {
    errors.push({ path: `${path}.children`, message: "children must be an array" });
    return;
  }
  if (children.length === 0) {
    errors.push({ path: `${path}.children`, message: "section needs at least one column" });
  }

  let widthSum = 0;
  let widthsValid = true;
  children.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    if (!isObject(child) || child["type"] !== "column") {
      errors.push({ path: childPath, message: "section children must be columns" });
      widthsValid = false;
      return;
    }
    validateColumn(child, childPath, errors, seenIds);
    if (checkFiniteNumber(child["widthPercent"], `${childPath}.widthPercent`, errors)) {
      widthSum += child["widthPercent"] as number;
    } else {
      widthsValid = false;
    }
  });

  if (widthsValid && children.length > 0 && Math.abs(widthSum - 100) > COLUMN_SUM_TOLERANCE) {
    errors.push({
      path: `${path}.children`,
      message: `column widthPercent values must sum to ~100 (got ${widthSum})`,
    });
  }
}

function validateColumn(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
  seenIds: Set<string>,
): void {
  checkId(value, path, errors, seenIds);
  checkStyle(value["style"], `${path}.style`, errors);

  const children = value["children"];
  if (!Array.isArray(children)) {
    errors.push({ path: `${path}.children`, message: "children must be an array" });
    return;
  }
  children.forEach((child, i) => {
    const childPath = `${path}.children[${i}]`;
    if (!isObject(child) || typeof child["type"] !== "string") {
      errors.push({ path: childPath, message: "leaf block must be an object with a type" });
      return;
    }
    if (!(LEAF_TYPES as readonly string[]).includes(child["type"])) {
      errors.push({
        path: `${childPath}.type`,
        message: `unknown leaf type "${child["type"]}"`,
      });
      return;
    }
    validateLeaf(child, childPath, errors, seenIds);
  });
}

function validateLeaf(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
  seenIds: Set<string>,
): void {
  checkId(value, path, errors, seenIds);
  const type = value["type"];

  switch (type) {
    case "text": {
      checkStyle(value["style"], `${path}.style`, errors);
      validateRichText(value["content"], `${path}.content`, errors);
      break;
    }
    case "image": {
      checkStyle(value["style"], `${path}.style`, errors);
      if (typeof value["src"] !== "string") {
        errors.push({ path: `${path}.src`, message: "src must be a string" });
      }
      if (typeof value["alt"] !== "string") {
        errors.push({ path: `${path}.alt`, message: "alt must be a string" });
      }
      if (value["href"] !== undefined && typeof value["href"] !== "string") {
        errors.push({ path: `${path}.href`, message: "href must be a string" });
      }
      break;
    }
    case "button": {
      checkStyle(value["style"], `${path}.style`, errors);
      if (typeof value["label"] !== "string") {
        errors.push({ path: `${path}.label`, message: "label must be a string" });
      }
      if (typeof value["href"] !== "string") {
        errors.push({ path: `${path}.href`, message: "href must be a string" });
      }
      break;
    }
    case "divider": {
      checkStyle(value["style"], `${path}.style`, errors);
      break;
    }
    case "spacer": {
      checkFiniteNumber(value["height"], `${path}.height`, errors);
      break;
    }
  }
}

function validateRichText(value: unknown, path: string, errors: ValidationError[]): void {
  if (!isObject(value) || value["type"] !== "doc") {
    errors.push({ path, message: 'rich text must be { type: "doc", content: [...] }' });
    return;
  }
  const content = value["content"];
  if (!Array.isArray(content)) {
    errors.push({ path: `${path}.content`, message: "content must be an array" });
    return;
  }
  content.forEach((para, i) => {
    const paraPath = `${path}.content[${i}]`;
    if (!isObject(para) || para["type"] !== "paragraph") {
      errors.push({ path: paraPath, message: "must be a paragraph" });
      return;
    }
    const runs = para["content"];
    if (runs === undefined) return;
    if (!Array.isArray(runs)) {
      errors.push({ path: `${paraPath}.content`, message: "must be an array of runs" });
      return;
    }
    runs.forEach((run, j) => {
      const runPath = `${paraPath}.content[${j}]`;
      if (!isObject(run) || run["type"] !== "text" || typeof run["text"] !== "string") {
        errors.push({ path: runPath, message: 'must be { type: "text", text: string }' });
        return;
      }
      const marks = run["marks"];
      if (marks !== undefined) {
        if (!Array.isArray(marks)) {
          errors.push({ path: `${runPath}.marks`, message: "marks must be an array" });
        } else {
          marks.forEach((m, k) => {
            if (!VALID_MARKS.has(m as Mark)) {
              errors.push({ path: `${runPath}.marks[${k}]`, message: `unknown mark "${m}"` });
            }
          });
        }
      }
      if (run["link"] !== undefined && typeof run["link"] !== "string") {
        errors.push({ path: `${runPath}.link`, message: "link must be a string" });
      }
    });
  });
}
