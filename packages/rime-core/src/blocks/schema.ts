// Serializable schema describing a block's editable props. The properties panel
// renders a form from this; nothing here references the DOM or an editor engine.

export type FieldType =
  | "text"
  | "number"
  | "color"
  | "select"
  | "boolean"
  | "spacing"
  | "align"
  | "url"
  | "richtext";

export interface FieldDef {
  // Prop key on the node; dot-paths address nested props (e.g. "style.paddingTop").
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  default?: unknown;
  // Properties-panel section, e.g. "Spacing" or "Colors".
  group?: string;
}

export interface BlockSchema {
  fields: FieldDef[];
}
