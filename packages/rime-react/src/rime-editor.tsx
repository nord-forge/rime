import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import "@nord-forge/rime-core/register"; // defines <rime-editor>
import type { RimeChangeDetail, RimeConfig, RimeDoc } from "@nord-forge/rime-core/register";

// The host element's imperative surface the wrapper drives.
interface RimeElement extends HTMLElement {
  config: RimeConfig;
  loadDoc(doc: RimeDoc): void;
  getDoc(): RimeDoc;
}

export interface RimeEditorProps {
  /** Controlled document value. Loaded on mount and whenever it changes (unless the
   *  change originated from the element's own `change`, to avoid a feedback loop). */
  doc?: RimeDoc;
  theme?: RimeConfig["theme"];
  enabledBlocks?: string[];
  onImageUpload?: (file: File) => Promise<string>;
  /** Use the Lexical rich-text editor (default true). */
  lexicalEditor?: boolean;
  /** Fired on every user edit with the new document. */
  onChange?: (doc: RimeDoc) => void;
  className?: string;
  style?: React.CSSProperties;
}

export interface RimeEditorHandle {
  getDoc(): RimeDoc | undefined;
  loadDoc(doc: RimeDoc): void;
}

export const RimeEditor = forwardRef<RimeEditorHandle, RimeEditorProps>(
  function RimeEditor(props, ref) {
    const { doc, theme, enabledBlocks, onImageUpload, lexicalEditor, onChange, className, style } =
      props;
    const elRef = useRef<RimeElement | null>(null);
    // The last doc this wrapper pushed into / received from the element. Used to break
    // the load↔change feedback loop: a `doc` prop equal to what the element already has
    // is not re-loaded, and a `change` we just emitted is not echoed back as a load.
    const lastDoc = useRef<RimeDoc | undefined>(undefined);
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    // config is an OBJECT property (not an attribute) — assign it imperatively and
    // re-assign whenever an input changes.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const config: RimeConfig = {};
      if (theme) config.theme = theme;
      if (enabledBlocks) config.enabledBlocks = enabledBlocks;
      if (onImageUpload) config.onImageUpload = onImageUpload;
      if (lexicalEditor !== undefined) config.lexicalEditor = lexicalEditor;
      el.config = config;
    }, [theme, enabledBlocks, onImageUpload, lexicalEditor]);

    // change → onChange. Track the emitted doc so the controlled-doc effect doesn't
    // re-load it.
    useEffect(() => {
      const el = elRef.current;
      if (!el) return;
      const handler = (e: Event) => {
        const next = (e as CustomEvent<RimeChangeDetail>).detail.doc;
        lastDoc.current = next;
        onChangeRef.current?.(next);
      };
      el.addEventListener("change", handler);
      return () => el.removeEventListener("change", handler);
    }, []);

    // Controlled `doc`: load on mount and when it changes to something the element
    // doesn't already have (guards the feedback loop).
    useEffect(() => {
      const el = elRef.current;
      if (!el || doc === undefined) return;
      if (doc === lastDoc.current) return; // originated here; don't echo
      lastDoc.current = doc;
      el.loadDoc(doc);
    }, [doc]);

    useImperativeHandle(
      ref,
      () => ({
        getDoc: () => elRef.current?.getDoc(),
        loadDoc: (d: RimeDoc) => {
          lastDoc.current = d;
          elRef.current?.loadDoc(d);
        },
      }),
      [],
    );

    // The custom element; cast keeps the JSX intrinsic scoped to this file.
    const Tag = "rime-editor" as unknown as React.FC<
      React.HTMLAttributes<HTMLElement> & { ref: React.Ref<RimeElement> }
    >;
    return <Tag ref={elRef} className={className} style={style} />;
  },
);
