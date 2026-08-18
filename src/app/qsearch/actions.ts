"use server";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const SINGLE_FILE_EXTS = new Set([
  ".py", ".js", ".ts", ".go", ".rs", ".cpp", ".c", ".h", ".hpp",
  ".java", ".rb", ".cs", ".yaml", ".yml", ".toml", ".json",
  ".cfg", ".conf", ".ini", ".tf", ".sh",
  ".pem", ".crt", ".cer",
]);

export type ScanResult = {
  files_scanned: number;
  quantum_vulnerable: number;
  high_risk: number;
  pqc_ready: number;
  findings: Array<{
    algorithm: string;
    classification: string;
    risk: string;
    asset: string;
    evidence: string;
  }>;
};

type QSearchResponse =
  | { ok: true; data: ScanResult }
  | { ok: false; error: string };

function getExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

export async function runQSearch(formData: FormData): Promise<QSearchResponse> {
  const serviceUrl = process.env.QSEARCH_SERVICE_URL;
  if (!serviceUrl) {
    return { ok: false, error: "qSearch service is not configured." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "A file is required." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File is larger than 50 MB." };
  }

  const ext = getExt(file.name);
  const isZip = ext === ".zip";
  const isSingleFile = SINGLE_FILE_EXTS.has(ext);

  if (!isZip && !isSingleFile) {
    return {
      ok: false,
      error: `Unsupported file type. Upload a ZIP archive or a single source file (${[...SINGLE_FILE_EXTS].join(", ")}).`,
    };
  }

  const body = Buffer.from(await file.arrayBuffer());

  let response: Response;
  try {
    response = await fetch(serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": isZip ? "application/zip" : "application/octet-stream",
        "X-File-Name": encodeURIComponent(file.name),
      },
      body,
    });
  } catch {
    return {
      ok: false,
      error: "qSearch service is not reachable. Make sure qsearch-service/server.py is running.",
    };
  }

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, error: text || "qSearch service failed." };
  }

  try {
    return { ok: true, data: JSON.parse(text) as ScanResult };
  } catch {
    return { ok: false, error: "qSearch returned unexpected output." };
  }
}