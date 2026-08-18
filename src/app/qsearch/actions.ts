"use server";

const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type ScanResult = {
  files_scanned: number;
  quantum_vulnerable: number;
  high_risk: number;
  pqc_ready: number;
  findings: {
    algorithm: string;
    classification: string;
    risk: string;
    asset: string;
    evidence: string;
  }[];
};

type QSearchResponse =
  | { ok: true; data: ScanResult }
  | { ok: false; error: string };

export async function runQSearch(formData: FormData): Promise<QSearchResponse> {
  const serviceUrl = process.env.QSEARCH_SERVICE_URL;
  if (!serviceUrl) {
    return { ok: false, error: "qSearch service is not configured." };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "A ZIP file is required." };
  }

  if (!file.name.toLowerCase().endsWith(".zip")) {
    return { ok: false, error: "Only ZIP files are supported." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "ZIP is larger than 50 MB." };
  }

  let response: Response;
  try {
    response = await fetch(serviceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/zip" },
      body: Buffer.from(await file.arrayBuffer()),
    });
  } catch {
    return { ok: false, error: "qSearch service is not reachable." };
  }

  const text = await response.text();
  if (!response.ok) {
    return { ok: false, error: text || "qSearch service failed." };
  }

  try {
    const data = JSON.parse(text) as ScanResult;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "qSearch returned unexpected output." };
  }
}