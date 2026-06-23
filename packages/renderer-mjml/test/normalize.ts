// Strip nondeterministic bits from compiled MJML output so golden snapshots are
// stable run-to-run. MJML is deterministic for a given version, but pin-safe
// normalization guards against incidental noise (and documents intent).

export function normalizeHtml(html: string): string {
  return (
    html
      // collapse trailing whitespace per line + normalize line endings
      .replaceAll("\r\n", "\n")
      .replace(/[ \t]+$/gm, "")
      // trim leading/trailing blank lines
      .trim() + "\n"
  );
}
