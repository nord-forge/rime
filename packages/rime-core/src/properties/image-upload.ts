// DOM-free resolution of an image upload, so the call/store/reject/no-op logic is
// unit-testable without a custom element. The library uploads NOTHING itself: it
// hands the File to the host's onImageUpload and interprets the result.

export type UploadOutcome =
  | { kind: "url"; url: string } // store this into src
  | { kind: "none" } // empty/absent return — keep the previous src
  | { kind: "error"; message: string }; // rejected — surface, keep previous src

/**
 * Call the host uploader and classify the result. A missing uploader or an
 * empty/whitespace return is a no-op ("none"); a rejection is an "error".
 */
export async function resolveUpload(
  uploader: ((file: File) => Promise<string>) | undefined,
  file: File,
): Promise<UploadOutcome> {
  if (!uploader) return { kind: "none" };
  try {
    const url = (await uploader(file))?.trim();
    return url ? { kind: "url", url } : { kind: "none" };
  } catch {
    return { kind: "error", message: "Upload failed. Please try again." };
  }
}
