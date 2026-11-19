// What qSearch accepts for upload: one ZIP, or one file of these types.
// Shared by the upload page and the server, so the two never disagree.

export const MAX_UPLOAD_MB = 50;

export const SINGLE_FILE_EXTS = [
  ".py", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".go", ".rs", ".c", ".h", ".cc", ".cpp", ".hpp",
  ".java", ".kt", ".scala", ".cs", ".rb", ".php", ".swift", ".sh",
  ".yaml", ".yml", ".toml", ".json", ".xml", ".cfg", ".conf", ".cnf", ".ini", ".tf", ".properties", ".gradle",
  ".md", ".txt",
  ".pem", ".crt", ".cer", ".key", ".pub",
];

/** For the file picker's accept attribute. */
export const ACCEPT = [".zip", ...SINGLE_FILE_EXTS, "application/zip"].join(",");

export const ACCEPT_TEXT = `A .zip of your code, or one file: ${SINGLE_FILE_EXTS.join(" ")}`;