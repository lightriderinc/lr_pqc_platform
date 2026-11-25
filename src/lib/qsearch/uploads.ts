// What qSearch accepts for upload: one ZIP, or one file of these types.
// Shared by the upload page and the server, so the two never disagree.

/**
 * Largest upload, in MB. The hosting platform (Vercel) rejects request bodies
 * over 4.5 MB before they reach the server, so the limit stays below that,
 * leaving room for the form data around the file.
 */
export const MAX_UPLOAD_MB = 4;

/** Shown when a file is too large: the same text in the browser and on the server. */
export const TOO_LARGE = `Files up to ${MAX_UPLOAD_MB} MB can be scanned here. Upload one folder of the project as a smaller ZIP; Veloce Desktop scans larger projects on your own computer.`;

export const SINGLE_FILE_EXTS = [
  ".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".go", ".rs", ".c", ".h", ".cc", ".cpp", ".hpp",
  ".java", ".kt", ".scala", ".cs", ".rb", ".php", ".swift", ".sh",
  ".yaml", ".yml", ".toml", ".json", ".xml", ".cfg", ".conf", ".cnf", ".ini", ".tf", ".properties", ".gradle",
  ".md", ".txt",
  ".pem", ".crt", ".cer", ".key", ".pub",
];

/** For the file picker's accept attribute. */
export const ACCEPT = [".zip", ...SINGLE_FILE_EXTS, "application/zip"].join(",");

export const ACCEPT_TEXT = `A .zip of your code (up to ${MAX_UPLOAD_MB} MB), or one file: ${SINGLE_FILE_EXTS.join(" ")}`;