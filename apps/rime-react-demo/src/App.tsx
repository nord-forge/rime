import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RimeEditor, type RimeConfig, type RimeDoc } from "@nord-forge/rime-react";
import { deserialize, serialize } from "@nord-forge/rime-model";
import { docToMjml } from "@nord-forge/rime-mjml/browser";
import { blockRegistry, registryToMjmlRenderers } from "@nord-forge/rime-core";
import "./app.css";

const STORAGE_KEY = "rime-react-demo-doc";

function starterDoc(): RimeDoc {
  return {
    id: "doc",
    type: "document",
    settings: { contentWidth: 600, backgroundColor: "#ffffff", fontFamily: "Arial, sans-serif" },
    children: [
      {
        id: "hero",
        type: "section",
        style: { paddingTop: 36, paddingBottom: 8, paddingLeft: 28, paddingRight: 28 },
        children: [
          {
            id: "hcol",
            type: "column",
            widthPercent: 100,
            style: {},
            children: [
              {
                id: "h1",
                type: "heading",
                level: 1,
                text: "Welcome aboard 👋",
                style: {},
              } as never,
              {
                id: "p1",
                type: "text",
                style: {},
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [
                        { type: "text", text: "Drag a block from the left, or edit this copy. " },
                        { type: "text", text: "Everything is plain JSON", marks: ["bold"] },
                        { type: "text", text: " — export it as MJML any time." },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        id: "ctaSec",
        type: "section",
        style: { paddingTop: 8, paddingBottom: 36, paddingLeft: 28, paddingRight: 28 },
        children: [
          {
            id: "ctaCol",
            type: "column",
            widthPercent: 100,
            style: { align: "center" },
            children: [
              {
                id: "cta",
                type: "button",
                label: "Get started",
                href: "https://example.com",
                style: { backgroundColor: "#5b5bd6", align: "center" },
              } as never,
            ],
          },
        ],
      },
    ],
  } as RimeDoc;
}

// Theme presets map directly onto the editor's --rime-* chrome tokens. The canvas
// (email styles) is unaffected — the two-surface model.
const THEMES: { id: string; label: string; theme: RimeConfig["theme"] }[] = [
  { id: "light", label: "Light", theme: {} },
  {
    id: "indigo",
    label: "Indigo",
    theme: {
      "--rime-color-accent": "#5b5bd6",
      "--rime-color-surface": "#f7f7fe",
      "--rime-radius": "10px",
    },
  },
  {
    id: "dark",
    label: "Dark",
    theme: {
      "--rime-color-bg": "#0c1020",
      "--rime-color-surface": "#161b2e",
      "--rime-color-fg": "#e7e9f5",
      "--rime-color-border": "#2a3150",
      "--rime-color-accent": "#8b8bf0",
    },
  },
];

// Stub uploader — object URL, no backend (a real app returns a CDN URL).
const onImageUpload = (file: File): Promise<string> => Promise.resolve(URL.createObjectURL(file));

function loadInitialDoc(): RimeDoc {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    const r = deserialize(raw);
    if (r.ok) return r.doc;
  }
  return starterDoc();
}

type SaveState = "idle" | "saving" | "saved";

export function App(): JSX.Element {
  const [doc, setDoc] = useState<RimeDoc>(loadInitialDoc);
  const [themeId, setThemeId] = useState("light");
  const [mjml, setMjml] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>("idle");
  const [copied, setCopied] = useState(false);
  const docRef = useRef(doc);
  docRef.current = doc;
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = useCallback((next: RimeDoc): void => {
    setDoc(next);
    setSave("saving");
    localStorage.setItem(STORAGE_KEY, serialize(next));
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSave("saved"), 350);
  }, []);

  useEffect(() => () => savedTimer.current && clearTimeout(savedTimer.current), []);

  const theme = useMemo(() => THEMES.find((t) => t.id === themeId)?.theme, [themeId]);

  const exportMjml = useCallback(() => {
    setCopied(false);
    setMjml(docToMjml(docRef.current, {}, registryToMjmlRenderers(blockRegistry)));
  }, []);

  const reset = useCallback(() => onChange(starterDoc()), [onChange]);

  const copy = useCallback(() => {
    if (mjml) void navigator.clipboard?.writeText(mjml).then(() => setCopied(true));
  }, [mjml]);

  const saveLabel = save === "saving" ? "Saving…" : save === "saved" ? "Saved" : "Up to date";

  return (
    <div className="app">
      <header className="bar">
        <div className="brand">
          <span className="mark">rime</span>
          <span className="tag">/email</span>
        </div>

        <span className="grow" />

        <span className="savestate" data-state={save} title="Autosaved to localStorage as JSON">
          <span className="dot" />
          {saveLabel}
        </span>

        <div className="seg" role="group" aria-label="Editor theme">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={t.id === themeId}
              onClick={() => setThemeId(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <button type="button" className="btn ghost" onClick={reset}>
          Reset
        </button>
        <button type="button" className="btn primary" onClick={exportMjml}>
          <CodeIcon />
          Export
        </button>
      </header>

      <main className="stage">
        <RimeEditor doc={doc} theme={theme} onImageUpload={onImageUpload} onChange={onChange} />
      </main>

      {mjml !== null && (
        <div
          className="scrim"
          role="dialog"
          aria-modal="true"
          aria-label="Exported MJML"
          onClick={() => setMjml(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="head">
              <h2>Exported MJML</h2>
              <span className="sub">rendered server-side to HTML</span>
              <span style={{ flex: 1 }} />
              <button type="button" className="btn ghost" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button type="button" className="btn" onClick={() => setMjml(null)}>
                Close
              </button>
            </div>
            <pre>{mjml}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeIcon(): JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m8 8-4 4 4 4" />
      <path d="m16 8 4 4-4 4" />
    </svg>
  );
}
