"use server";

import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { unzipSync } from "fflate";
import { chmodSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const MAX_UPLOAD = 50 * 1024 * 1024;
const TIMEOUT = 300_000;

const QSEARCH_BIN = join(
  process.cwd(),
  "qsearch-service",
  process.platform === "win32" ? "qsearch.exe" : "qsearch",
);

const SINGLE_FILE_EXTS = new Set([
  ".py",
  ".js",
  ".ts",
  ".go",
  ".rs",
  ".cpp",
  ".c",
  ".h",
  ".hpp",
  ".java",
  ".rb",
  ".cs",
  ".yaml",
  ".yml",
  ".toml",
  ".json",
  ".cfg",
  ".conf",
  ".ini",
  ".tf",
  ".sh",
  ".pem",
  ".crt",
  ".cer",
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
    detail: string;
    service: string;
    provenance: string;
    confidence: string;
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
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "A file is required." };
  }

  if (file.size > MAX_UPLOAD) {
    return { ok: false, error: "File is larger than 50 MB." };
  }

  const ext = getExt(file.name);
  const isZip = ext === ".zip";
  const isSingle = SINGLE_FILE_EXTS.has(ext);

  if (!isZip && !isSingle) {
    return {
      ok: false,
      error: "Unsupported file type. Upload a ZIP or a source file.",
    };
  }

  const id = randomBytes(8).toString("hex");
  const tmp = join(tmpdir(), `qsearch-${id}`);
  const srcDir = join(tmp, "source");
  const outDir = join(tmp, "output");

  try {
    await mkdir(srcDir, { recursive: true });
    await mkdir(outDir, { recursive: true });

    const bytes = Buffer.from(await file.arrayBuffer());

    if (isZip) {
      const zipPath = join(tmp, "upload.zip");
      await writeFile(zipPath, bytes);

      const zipBytes = new Uint8Array(bytes);
      const extracted = unzipSync(zipBytes);
      for (const [filename, content] of Object.entries(extracted)) {
        if (filename.endsWith("/")) continue;
        const outPath = join(srcDir, filename);
        await mkdir(outPath.substring(0, outPath.lastIndexOf("/")), {
          recursive: true,
        }).catch(() => {});
        await writeFile(outPath, content);
      }
    } else {
      await writeFile(join(srcDir, file.name), bytes);
    }

    try {
      chmodSync(QSEARCH_BIN, 0o755);
    } catch {
      /* windows ok */
    }

    await execFileAsync(
      QSEARCH_BIN,
      ["scan", srcDir, "--out", outDir, "--quiet"],
      { timeout: TIMEOUT },
    );

    const raw = JSON.parse(
      await readFile(join(outDir, "findings.json"), "utf8"),
    );

    const findings = raw.findings ?? [];
    return {
      ok: true,
      data: {
        files_scanned: raw.files_scanned ?? 0,
        quantum_vulnerable: findings.filter(
          (f: { classification: string }) =>
            f.classification === "quantum-vulnerable",
        ).length,
        high_risk: findings.filter((f: { risk: string }) => f.risk === "high")
          .length,
        pqc_ready: findings.filter(
          (f: { classification: string }) => f.classification === "pqc-ready",
        ).length,
        findings: findings.map(
          (f: {
            algorithm?: string;
            classification?: string;
            risk?: string;
            asset?: string;
            source_of_evidence?: string;
            detail?: string;
            cryptographic_service?: string;
            provenance?: string;
            confidence?: string;
          }) => ({
            algorithm: f.algorithm ?? "",
            classification: f.classification ?? "",
            risk: f.risk ?? "",
            asset: f.asset ?? "",
            evidence: f.source_of_evidence ?? "",
            detail: f.detail ?? "",
            service: f.cryptographic_service ?? "",
            provenance: f.provenance ?? "",
            confidence: f.confidence ?? "",
          }),
        ),
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return { ok: false, error: message };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}
