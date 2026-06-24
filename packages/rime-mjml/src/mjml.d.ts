// Minimal ambient types for the `mjml` library (it ships none, and @types/mjml
// pulls a large dep tree). Covers only the surface MjmlRenderer uses.
declare module "mjml" {
  interface MjmlError {
    line?: number;
    message?: string;
    tagName?: string;
    formattedMessage?: string;
  }

  interface MjmlOptions {
    validationLevel?: "strict" | "soft" | "skip";
    filePath?: string;
    fonts?: Record<string, string>;
  }

  interface MjmlResult {
    html: string;
    errors: MjmlError[];
  }

  export default function mjml2html(mjml: string, options?: MjmlOptions): MjmlResult;
}
