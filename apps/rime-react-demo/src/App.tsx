import { useMemo, useRef, useState } from "react";
import { RimeEditor, type RimeDoc, type RimeConfig } from "@nord-forge/rime-react";
import { deserialize, serialize } from "@nord-forge/rime-model";
import { docToMjml } from "@nord-forge/rime-mjml/browser";
import { blockRegistry, registryToMjmlRenderers } from "@nord-forge/rime-core";

const STORAGE_KEY = "rime-react-demo-doc";

function starterDoc(): RimeDoc {
  return {
    id: "doc",
    type: "document",
    settings: { contentWidth: 600, backgroundColor: "#f4f4f5", fontFamily: "Arial, sans-serif" },
    children: [
      {
        id: "section",
        type: "section",
        style: { paddingTop: 24, paddingBottom: 24 },
        children: [
          {
            id: "column",
            type: "column",
            widthPercent: 100,
            style: {},
            children: [
              {
                id: "intro",
                type: "text",
                style: {},
                content: {
                  type: "doc",
                  content: [
                    {
                      type: "paragraph",
                      content: [{ type: "text", text: "Edit me — this is the React wrapper." }],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  } as RimeDoc;
}

const THEMES: Record<string, RimeConfig["theme"]> = {
  Default: {},
  "Brand purple": {
    "--eb-color-accent": "#7c3aed",
    "--eb-color-surface": "#faf5ff",
    "--eb-radius": "12px",
  },
  Dark: {
    "--eb-color-bg": "#18181b",
    "--eb-color-surface": "#27272a",
    "--eb-color-fg": "#e4e4e7",
    "--eb-color-border": "#3f3f46",
    "--eb-color-accent": "#22d3ee",
  },
};

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

export function App(): JSX.Element {
  // Controlled value — the React idiom the wrapper supports.
  const [doc, setDoc] = useState<RimeDoc>(loadInitialDoc);
  const [themeName, setThemeName] = useState("Default");
  const [mjml, setMjml] = useState<string | null>(null);
  const docRef = useRef(doc);
  docRef.current = doc;

  const onChange = (next: RimeDoc): void => {
    setDoc(next);
    localStorage.setItem(STORAGE_KEY, serialize(next));
  };

  const exported = useMemo(
    () => () => {
      setMjml(docToMjml(docRef.current, {}, registryToMjmlRenderers(blockRegistry)));
    },
    [],
  );

  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", blockSize: "100vh" }}>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          padding: "8px 12px",
          borderBlockEnd: "1px solid #e4e4e7",
        }}
      >
        <strong>Rime React demo</strong>
        <button type="button" onClick={() => onChange(starterDoc())}>
          Reset
        </button>
        <span style={{ flex: 1 }} />
        <label>
          Theme{" "}
          <select value={themeName} onChange={(e) => setThemeName(e.target.value)}>
            {Object.keys(THEMES).map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={exported}>
          View MJML
        </button>
      </div>

      <RimeEditor
        doc={doc}
        theme={THEMES[themeName]}
        onImageUpload={onImageUpload}
        onChange={onChange}
        style={{ blockSize: "100%", minBlockSize: 0 }}
      />

      {mjml !== null && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.4)",
            display: "grid",
            placeItems: "center",
          }}
          onClick={() => setMjml(null)}
        >
          <div
            style={{
              inlineSize: "min(820px,90vw)",
              blockSize: "80vh",
              background: "#fff",
              borderRadius: 10,
              overflow: "hidden",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: "10px 14px", borderBlockEnd: "1px solid #e4e4e7" }}>
              <strong>Exported MJML (→ HTML server-side)</strong>
              <button type="button" style={{ float: "right" }} onClick={() => setMjml(null)}>
                Close
              </button>
            </div>
            <pre
              style={{
                margin: 0,
                padding: 14,
                blockSize: "calc(80vh - 52px)",
                overflow: "auto",
                whiteSpace: "pre-wrap",
                background: "#18181b",
                color: "#e4e4e7",
                font: "12px/1.5 ui-monospace, monospace",
              }}
            >
              {mjml}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
