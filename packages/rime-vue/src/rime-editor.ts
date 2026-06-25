import {
  defineComponent,
  h,
  onBeforeUnmount,
  onMounted,
  type PropType,
  ref,
  toRaw,
  watch,
} from "vue";
import "@nord-forge/rime-core/register"; // defines <rime-editor>
import type { RimeChangeDetail, RimeConfig, RimeDoc } from "@nord-forge/rime-core/register";

// The host element's imperative surface the wrapper drives.
interface RimeElement extends HTMLElement {
  config: RimeConfig;
  loadDoc(doc: RimeDoc): void;
  getDoc(): RimeDoc;
}

// Thin Vue wrapper over <rime-editor>. v-model binds the document; theme/
// enabledBlocks/onImageUpload map onto the element's `config` object property. All
// editor logic lives in @nord-forge/rime-core.
//
// Consumers must tell Vue that `rime-editor` is a custom element, e.g.:
//   app.config.compilerOptions.isCustomElement = (tag) => tag === "rime-editor";
// (or the equivalent `compilerOptions.isCustomElement` in vite-plugin-vue). This
// wrapper renders the element itself, so the warning only matters if you also use
// the tag directly in templates.
export const RimeEditor = defineComponent({
  name: "RimeEditor",
  props: {
    modelValue: { type: Object as PropType<RimeDoc>, default: undefined },
    theme: { type: Object as PropType<RimeConfig["theme"]>, default: undefined },
    enabledBlocks: { type: Array as PropType<string[]>, default: undefined },
    onImageUpload: {
      type: Function as PropType<(file: File) => Promise<string>>,
      default: undefined,
    },
    lexicalEditor: { type: Boolean as PropType<boolean | undefined>, default: undefined },
  },
  emits: ["update:modelValue", "change"],
  setup(props, { emit }) {
    const elRef = ref<RimeElement | null>(null);
    // Break the load↔change feedback loop: the last doc pushed into / received from
    // the element. A modelValue equal to it is not re-loaded; a change we emitted is
    // not echoed back as a load.
    let lastDoc: RimeDoc | undefined;

    const applyConfig = (): void => {
      const el = elRef.value;
      if (!el) return;
      const config: RimeConfig = {};
      if (props.theme) config.theme = props.theme;
      if (props.enabledBlocks) config.enabledBlocks = props.enabledBlocks;
      if (props.onImageUpload) config.onImageUpload = props.onImageUpload;
      if (props.lexicalEditor !== undefined) config.lexicalEditor = props.lexicalEditor;
      el.config = config;
    };

    const onChange = (e: Event): void => {
      const next = (e as CustomEvent<RimeChangeDetail>).detail.doc;
      lastDoc = next;
      emit("update:modelValue", next);
      emit("change", next);
    };

    // Load a doc into the element, recording the RAW value so the feedback-loop
    // guard compares stably (Vue re-proxies modelValue on every parent write).
    const load = (el: RimeElement, doc: RimeDoc): void => {
      const raw = toRaw(doc);
      lastDoc = raw;
      el.loadDoc(raw);
    };

    onMounted(() => {
      const el = elRef.value;
      if (!el) return;
      el.addEventListener("change", onChange);
      applyConfig();
      if (props.modelValue !== undefined) load(el, props.modelValue);
    });

    onBeforeUnmount(() => {
      elRef.value?.removeEventListener("change", onChange);
    });

    // Re-assign config when any config-derived prop changes.
    watch(
      () => [props.theme, props.enabledBlocks, props.onImageUpload, props.lexicalEditor],
      () => applyConfig(),
    );

    // v-model: load an external doc change (one that didn't originate from the
    // element's own `change`). Compare the RAW value, since Vue re-proxies modelValue
    // on every parent write — including when we echo it back via update:modelValue.
    watch(
      () => props.modelValue,
      (doc) => {
        const el = elRef.value;
        if (!el || doc === undefined || toRaw(doc) === lastDoc) return;
        load(el, doc);
      },
    );

    return () => h("rime-editor", { ref: elRef });
  },
});

export default RimeEditor;
