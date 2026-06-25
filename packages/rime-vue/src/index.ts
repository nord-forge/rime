// @nord-forge/rime-vue — thin Vue wrapper over <rime-editor>. The editor logic lives
// in @nord-forge/rime-core; this maps Vue props/events/v-model onto the element.

export { RimeEditor, default } from "./rime-editor";
export type { RimeChangeDetail, RimeConfig, RimeDoc } from "@nord-forge/rime-core/register";
