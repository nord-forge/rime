// Hand-written validator (no schema library — keeps the package dependency-free
// and tiny, and usable headless/server-side). Walks the tree, enforcing node
// shapes, legal parent→child nesting, unique ids, and column-width sums, and
// reports every problem with a precise JSON-ish `path`.

import { type RimeDoc, LEAF_TYPES } from "./types";
import type { Mark } from "./rich-text";

/** A single validation problem, located by `path`. */
export interface ValidationError {
  /** e.g. `children[0].children[2].widthPercent`. */
  path: string;
  message: string;
}

export type ValidateResult = { ok: true; doc: RimeDoc } | { ok: false; errors: ValidationError[] };

export interface ValidateOptions {
  // Leaf block types beyond the built-ins to accept as valid (e.g. registered
  // custom blocks). Such a leaf is validated for the common shape only — id and,
  // if present, BlockStyle — since the doc model is headless and does not know a
  // registered block's prop schema. The block's own schema validates the rest.
  extraLeafTypes?: Iterable<string>;
  // Section-level "band" block types accepted as direct children of the document,
  // beside sections (e.g. a hero). Validated for the common shape only (id + style),
  // same as a custom leaf — the block's own schema validates the rest.
  extraSectionTypes?: Iterable<string>;
}

const VALID_MARKS = new Set<Mark>(["bold", "italic", "underline"]);
const VALID_ALIGN = new Set(["left", "center", "right"]);
const COLUMN_SUM_TOLERANCE = 1; // ±1% for rounding

/** Validate an unknown value as an RimeDoc. */
export function validateDoc(value: unknown, options: ValidateOptions = {}): ValidateResult {
  const errors: ValidationError[] = [];
  const seenIds = new Set<string>();
  const allowedLeaves = new Set<string>([...LEAF_TYPES, ...(options.extraLeafTypes ?? [])]);
  const allowedBands = new Set<string>(options.extraSectionTypes ?? []);

  validateDocument(value, "$", errors, seenIds, allowedLeaves, allowedBands);

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, doc: value as RimeDoc };
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
  allowedLeaves: Set<string>,
  allowedBands: Set<string>,
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
    if (!isObject(child) || typeof child["type"] !== "string") {
      errors.push({ path: childPath, message: "document child must be an object with a type" });
      return;
    }
    if (child["type"] === "section") {
      validateSection(child, childPath, errors, seenIds, allowedLeaves);
      return;
    }
    // A registered section-level band block (allowed via extraSectionTypes). The
    // doc model validates the common shape only; the block's schema validates props.
    if (allowedBands.has(child["type"])) {
      checkId(child, childPath, errors, seenIds);
      if (child["style"] !== undefined) checkStyle(child["style"], `${childPath}.style`, errors);
      return;
    }
    errors.push({
      path: childPath,
      message: "document children must be sections or registered section-level blocks",
    });
  });
}

function validateSection(
  value: Record<string, unknown>,
  path: string,
  errors: ValidationError[],
  seenIds: Set<string>,
  allowedLeaves: Set<string>,
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
    validateColumn(child, childPath, errors, seenIds, allowedLeaves);
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
  allowedLeaves: Set<string>,
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
    if (!allowedLeaves.has(child["type"])) {
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
    default: {
      // A registered custom leaf (allowed via extraLeafTypes). The doc model only
      // validates the common shape; the block's own schema validates its props.
      if (value["style"] !== undefined) checkStyle(value["style"], `${path}.style`, errors);
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
  content.forEach((block, i) => {
    const blockPath = `${path}.content[${i}]`;
    if (!isObject(block)) {
      errors.push({ path: blockPath, message: "must be a rich-text block" });
      return;
    }
    switch (block["type"]) {
      case "paragraph":
        validateRuns(block["content"], `${blockPath}.content`, errors);
        break;
      case "heading":
        if (block["level"] !== 1 && block["level"] !== 2 && block["level"] !== 3) {
          errors.push({ path: `${blockPath}.level`, message: "heading level must be 1, 2 or 3" });
        }
        validateRuns(block["content"], `${blockPath}.content`, errors);
        break;
      case "list": {
        if (typeof block["ordered"] !== "boolean") {
          errors.push({ path: `${blockPath}.ordered`, message: "ordered must be a boolean" });
        }
        const items = block["items"];
        if (!Array.isArray(items)) {
          errors.push({ path: `${blockPath}.items`, message: "items must be an array" });
          break;
        }
        items.forEach((item, j) => {
          const itemPath = `${blockPath}.items[${j}]`;
          if (!isObject(item) || item["type"] !== "listitem") {
            errors.push({ path: itemPath, message: 'must be { type: "listitem" }' });
            return;
          }
          validateRuns(item["content"], `${itemPath}.content`, errors);
        });
        break;
      }
      default:
        errors.push({ path: blockPath, message: "must be a paragraph, heading or list" });
    }
  });
}

function validateRuns(runs: unknown, path: string, errors: ValidationError[]): void {
  if (runs === undefined) return;
  if (!Array.isArray(runs)) {
    errors.push({ path, message: "must be an array of runs" });
    return;
  }
  runs.forEach((run, j) => {
    const runPath = `${path}[${j}]`;
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
}
