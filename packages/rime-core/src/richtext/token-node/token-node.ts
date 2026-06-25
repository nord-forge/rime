// An atomic inline merge tag inside the Lexical editor. A TextNode subclass in
// "token" mode (navigated/deleted as a unit, not editable char-by-char). It stores
// the bare key (no braces) and an optional display label; the chip shows
// `label ?? token`, themed via --rime-*. Serializes to/from the portable TokenInline
// in serialize.ts. It is part of the curated node set so it survives paste round
// trips and nothing else.

import {
  $applyNodeReplacement,
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
} from "lexical";

export type SerializedTokenNode = Spread<{ token: string; label?: string }, SerializedTextNode>;

export class TokenNode extends TextNode {
  __token: string;
  __label: string | undefined;

  static getType(): string {
    return "rime-token";
  }

  static clone(node: TokenNode): TokenNode {
    return new TokenNode(node.__token, node.__label, node.__key);
  }

  constructor(token: string, label?: string, key?: NodeKey) {
    super(label ?? token, key);
    this.__token = token;
    this.__label = label;
    // Token mode makes the node atomic: it is selected/deleted as a whole.
    this.setMode("token");
  }

  getToken(): string {
    return this.__token;
  }

  getLabel(): string | undefined {
    return this.__label;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.dataset["token"] = this.__token;
    dom.style.display = "inline-block";
    dom.style.padding = "0 4px";
    dom.style.borderRadius = "3px";
    dom.style.background = "var(--rime-token-bg, var(--rime-accent-soft, #e8eefc))";
    dom.style.color = "var(--rime-token-fg, var(--rime-accent, #2748b8))";
    dom.style.fontSize = "0.9em";
    dom.style.whiteSpace = "nowrap";
    return dom;
  }

  // A token never merges with adjacent text, even if its visible text matches.
  isTextEntity(): boolean {
    return true;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  static importJSON(serialized: SerializedTokenNode): TokenNode {
    return $createTokenNode(serialized.token, serialized.label);
  }

  exportJSON(): SerializedTokenNode {
    return {
      ...super.exportJSON(),
      type: TokenNode.getType(),
      token: this.__token,
      label: this.__label,
    };
  }
}

export function $createTokenNode(token: string, label?: string): TokenNode {
  return $applyNodeReplacement(new TokenNode(token, label));
}

export function $isTokenNode(node: LexicalNode | null | undefined): node is TokenNode {
  return node instanceof TokenNode;
}
