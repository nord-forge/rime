// @nord-forge/rime-react — thin React wrapper over <rime-editor>. The editor logic
// lives in @nord-forge/rime-core; this maps React props/events/refs onto the element.

export { RimeEditor, type RimeEditorHandle, type RimeEditorProps } from "./rime-editor";
export type { RimeChangeDetail, RimeConfig, RimeDoc } from "@nord-forge/rime-core/register";
