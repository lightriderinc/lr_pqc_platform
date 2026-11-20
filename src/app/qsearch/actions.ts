"use server";

import { getSession } from "@/lib/auth/session";
import { compareFindings, type Comparison } from "@/lib/qsearch/compare";
import { cleanReview, cleanSystem, type Review, type SystemDetails } from "@/lib/qsearch/inventory";
import { keyDetails, type CertificateDetails, type KeySource } from "@/lib/qsearch/enrich";
import { redactDetail } from "@/lib/qsearch/redact";
import { CheckError, checkServer, serverFindings, type ServerCheck } from "@/lib/qsearch/serverCheck";
import { checkProvider, type ProviderCheck } from "@/lib/qsearch/identityProvider";
import {
  deleteScan as deleteStoredScan,
  getScan,
  listScans,
  previousScan,
  saveScan,
  updateInventory,
  type ScanSummary,
} from "@/lib/qsearch/scanStore";
import { execFile } from "child_process";
import { randomBytes } from "crypto";
import { unzipSync } from "fflate";
import { chmodSync } from "fs";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { basename, dirname, isAbsolute, join, relative } from "path";
import { promisify } from "util";
import { MAX_UPLOAD_MB, SINGLE_FILE_EXTS as SINGLE_FILE_LIST } from "@/lib/qsearch/uploads";

const execFileAsync = promisify(execFile);

/** Upload limits. MAX_UPLOAD must stay below serverActions.bodySizeLimit in next.config.ts. */
const MAX_UPLOAD = MAX_UPLOAD_MB * 1024 * 1024;
const MAX_FILES = 5000;
const MAX_EXTRACTED = 200 * 1024 * 1024;
const TIMEOUT = 50_000;

const QSEARCH_BIN = join(
  process.cwd(),
  "qsearch-service",
  process.platform === "win32" ? "qsearch.exe" : "qsearch",
);

const SINGLE_FILE_EXTS = new Set(SINGLE_FILE_LIST);

/** Report files qSearch writes, returned for download alongside the findings. */
const REPORT_FILES = {
  csv: "findings.csv",
  summary: "executive-summary.txt",
} as const;

export type ScanReports = Record<keyof typeof REPORT_FILES, string>;

/** A scan as qSearch produced it: what is saved to history. */
export type ScanData = {
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
    /** Added by the website from the scanned files. Absent on older saved scans. */
    keyBits?: number | null;
    parameterSet?: string | null;
    keySource?: KeySource | null;
    certificate?: CertificateDetails | null;
  }>;
  reports: ScanReports;
};

/** Where a scan sits in the user's history. */
export type SavedScan = {
  id: string;
  project: string;
  createdAt: string;
  /** Changes since the previous scan of the same project; null for the first. */
  /** Changes since the previous scan of the same project; null for the first. */
  comparison: Comparison | null;
  /** Information system details for the federal inventory, if entered. */
  /** Information system details for the federal inventory, if entered. */
  system: SystemDetails | null;
  /** The user's review of the inventory, if any. */
  review: Review | null;
};

/** `saved` is null when the scan could not be saved to history. */
export type ScanResult = ScanData & { saved: SavedScan | null };

type Failure = { ok: false; error: string; authRequired?: boolean };
type QSearchResponse = { ok: true; data: ScanResult } | Failure;

const SIGNED_OUT: Failure = {
  ok: false,
  authRequired: true,
  error: "Your session has ended. Sign in again to run this scan.",
};

/** The signed-in user's id, from the verified session. Null when signed out. */
async function currentOwner(): Promise<string | null> {
  const { isAuthenticated, claims } = await getSession();
  return isAuthenticated && claims?.sub ? claims.sub : null;
}

/** Only the base name is kept, limited to safe characters. */
const safeFileName = (name: string) => basename(name.replace(/\\/g, "/")).replace(/[^\w.-]/g, "_").slice(0, 120);

/**
 * Scans of files with the same name, minus extension, are compared. A
 * browser's duplicate-download suffix, such as " (1)" (saved as "__1_"),
 * is ignored so a re-downloaded ZIP still matches its project.
 */
const projectOf = (fileName: string) =>
  fileName.replace(/\.[^.]*$/, "").replace(/__\d+_$/, "") || fileName;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Error with a message that is safe to show to the user. */
class UserError extends Error { }

function getExt(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

/**
 * Where a ZIP entry may be written, or null if it would land outside root.
 * Entry names are attacker-controlled: "../x", "/x" and "C:\x" are all refused.
 */
function safeEntryPath(root: string, name: string): string | null {
  const clean = name.replace(/\\/g, "/");
  if (clean.includes("\0") || isAbsolute(clean) || /^[a-zA-Z]:/.test(clean)) return null;
  const target = join(root, clean);
  const rel = relative(root, target);
  return rel && !rel.startsWith("..") && !isAbsolute(rel) ? target : null;
}

/** Writes the ZIP's files under srcDir, within the file count and size limits. */
async function extractZip(bytes: Uint8Array, srcDir: string) {
  let files = 0;
  let total = 0;
  let tooLarge = false;
  const extracted = unzipSync(bytes, {
    // Runs before each file is decompressed. fflate never writes more than the
    // declared size, so a header that lies about size cannot exceed the limit.
    filter: (entry) => {
      if (entry.name.endsWith("/")) return false;
      files += 1;
      total += entry.originalSize;
      if (files > MAX_FILES || total > MAX_EXTRACTED) tooLarge = true;
      return !tooLarge;
    },
  });
  if (tooLarge) throw new UserError("This ZIP is too large to scan: at most 5,000 files and 200 MB unpacked.");

  for (const [name, content] of Object.entries(extracted)) {
    const target = safeEntryPath(srcDir, name);
    if (!target) throw new UserError("This ZIP contains a file path that points outside the archive.");
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

export async function runQSearch(formData: FormData): Promise<QSearchResponse> {
  // The session is verified here, at submit time, rather than by interrupting
  // the user mid-upload: a server action is a public endpoint, and the session
  // can end on another platform while a file sits selected. `authRequired`
  // lets the console offer a sign-in instead of a dead-end error.
  const owner = await currentOwner();
  if (!owner) return SIGNED_OUT;
  if (rateLimited(owner, "scan")) {
    return { ok: false, error: `You can run up to ${PER_MINUTE} scans a minute. Try again shortly.` };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "A file is required." };
  }

  if (file.size > MAX_UPLOAD) {
    return { ok: false, error: `File is larger than ${MAX_UPLOAD_MB} MB.` };
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

  const tmp = join(tmpdir(), `qsearch-${randomBytes(8).toString("hex")}`);
  const srcDir = join(tmp, "source");
  const outDir = join(tmp, "output");

  try {
    await mkdir(srcDir, { recursive: true });
    await mkdir(outDir, { recursive: true });

    const bytes = new Uint8Array(await file.arrayBuffer());

    if (isZip) {
      try {
        await extractZip(bytes, srcDir);
      } catch (e) {
        if (e instanceof UserError) throw e;
        throw new UserError("This ZIP file could not be read.");
      }
    } else {
      await writeFile(join(srcDir, safeFileName(file.name)), bytes);
    }

    try {
      chmodSync(QSEARCH_BIN, 0o755);
    } catch {
      /* windows ok */
    }

    // Scanning "." from inside srcDir keeps the server's temporary path out of
    // every finding and report.
    await execFileAsync(QSEARCH_BIN, ["scan", ".", "--out", outDir, "--quiet"], {
      cwd: srcDir,
      timeout: TIMEOUT,
      // Only PATH: the scanner never sees the website's secrets (Supabase,
      // Logto, LR_TOKEN), which it would otherwise inherit.
      env: { PATH: process.env.PATH ?? "/usr/bin:/bin", NODE_ENV: process.env.NODE_ENV },
    });

    const read = (name: string) => readFile(join(outDir, name), "utf8");
    const raw = JSON.parse(await read("findings.json"));
    const reports = Object.fromEntries(
      await Promise.all(Object.entries(REPORT_FILES).map(async ([key, name]) => [key, await read(name)])),
    ) as ScanReports;

    const findings = raw.findings ?? [];
    // Matches in comments and documentation (confidence "low") are listed
    // but not counted.
    const counted = findings.filter((f: { confidence?: string }) => f.confidence !== "low");
    const data: ScanData = {
      files_scanned: raw.files_scanned ?? 0,
      quantum_vulnerable: counted.filter(
        (f: { classification: string }) =>
          f.classification === "quantum-vulnerable",
      ).length,
      high_risk: counted.filter((f: { risk: string }) => f.risk === "high")
        .length,
      pqc_ready: counted.filter(
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
          // Secrets on the matched line are hidden before anything is shown or saved.
          detail: redactDetail(f.detail ?? ""),
          service: f.cryptographic_service ?? "",
          provenance: f.provenance ?? "",
          confidence: f.confidence ?? "",
        }),
      ),
      reports,
    };
    // Read before the uploaded files are deleted in `finally`.
    const keys = await keyDetails(data.findings, srcDir);
    data.findings = data.findings.map((f, i) => ({ ...f, ...keys[i] }));
    return { ok: true, data: { ...data, saved: await save(owner, safeFileName(file.name), data) } };
  } catch (err: unknown) {
    if (err instanceof UserError) return { ok: false, error: err.message };
    // Details stay in the server log; the user sees a message with no paths.
    console.error("qSearch scan failed:", err);
    const timedOut = (err as { killed?: boolean })?.killed === true;
    return {
      ok: false,
      error: timedOut ? "The scan took longer than 50 seconds and was stopped. Try a smaller upload." : "The scan could not be completed.",
    };
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => { });
  }
}

/**
 * Saves a finished scan and compares it with the previous scan of the same
 * project. A database failure returns null: the user still gets the results.
 */
/** Storage is used only when Supabase is configured; otherwise it is skipped at once. */
const STORAGE_ON = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;

async function save(owner: string, fileName: string, data: ScanData): Promise<SavedScan | null> {
  if (!STORAGE_ON) return null;
  const project = projectOf(fileName);
  try {
    const previous = await previousScan(owner, project);
    // System details carry over from the previous scan of the same project.
    // System details and review carry over from the previous scan of the same project.
    const system = previous?.system ?? null;
    const review = previous?.review ?? null;
    const { id, createdAt } = await saveScan(owner, project, fileName, data, system, review);
    return {
      id,
      project,
      createdAt,
      comparison: previous ? compareFindings(previous.findings, data.findings, previous.createdAt) : null,
      system,
      review,
    };
  } catch {
    return null;
  }
}

const STORE_FAILED = "Your scan history could not be reached. Try again shortly.";

export async function listScanHistory(): Promise<{ ok: true; scans: ScanSummary[] } | Failure> {
  const owner = await currentOwner();
  if (!owner) return SIGNED_OUT;
  if (!STORAGE_ON) return { ok: false, error: "Scan history is not set up yet." };
  try {
    return { ok: true, scans: await listScans(owner) };
  } catch {
    return { ok: false, error: STORE_FAILED };
  }
}

/** Reopens a saved scan, with its comparison to the scan before it. */
export async function openScan(id: unknown): Promise<QSearchResponse> {
  const owner = await currentOwner();
  if (!owner) return SIGNED_OUT;
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "That scan was not found." };
  try {
    const stored = await getScan(owner, id);
    if (!stored) return { ok: false, error: "That scan was not found." };
    const previous = await previousScan(owner, stored.project, stored.createdAt);
    return {
      ok: true,
      data: {
        ...stored.scan,
        saved: {
          id: stored.id,
          project: stored.project,
          createdAt: stored.createdAt,
          comparison: previous ? compareFindings(previous.findings, stored.scan.findings, previous.createdAt) : null,
          system: stored.system,
          review: stored.review,
        },
      },
    };
  } catch {
    return { ok: false, error: STORE_FAILED };
  }
}

export async function deleteScan(id: unknown): Promise<{ ok: true } | Failure> {
  const owner = await currentOwner();
  if (!owner) return SIGNED_OUT;
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "That scan was not found." };
  try {
    return (await deleteStoredScan(owner, id)) ? { ok: true } : { ok: false, error: "That scan was not found." };
  } catch {
    return { ok: false, error: STORE_FAILED };
  }
}

/** Scans and server checks per user per minute, each. Kept in memory, so it applies per server instance. */
const PER_MINUTE = 10;
const recent = new Map<string, number[]>();

function rateLimited(owner: string, kind: "scan" | "check"): boolean {
  const key = `${kind}:${owner}`;
  const now = Date.now();
  const times = (recent.get(key) ?? []).filter((t) => now - t < 60_000);
  if (times.length >= PER_MINUTE) return true;
  times.push(now);
  recent.set(key, times);
  return false;
}

export type ServerCheckResult = ServerCheck & { findings: ReturnType<typeof serverFindings> };

/** Connects to a server the user names and reports its key exchange and certificates. */
export async function runServerCheck(
  host: unknown,
  port: unknown,
): Promise<{ ok: true; data: ServerCheckResult } | Failure> {
  const owner = await currentOwner();
  if (!owner) return SIGNED_OUT;
  if (typeof host !== "string" || (port !== undefined && (typeof port !== "number" || !Number.isInteger(port)))) {
    return { ok: false, error: "Enter a hostname, such as example.com." };
  }
  if (rateLimited(owner, "check")) {
    return { ok: false, error: `You can check up to ${PER_MINUTE} servers a minute. Try again shortly.` };
  }
  try {
    const check = await checkServer(host, port);
    return { ok: true, data: { ...check, findings: serverFindings(check) } };
  } catch (e) {
    if (e instanceof CheckError) return { ok: false, error: e.message };
    console.error("Server check failed:", e);
    return { ok: false, error: "The server could not be checked." };
  }
}

/** Saves the system details and review entered for a saved scan. Both are validated here. */
export async function saveInventory(
  id: unknown,
  details: unknown,
  reviewInput: unknown,
): Promise<{ ok: true; system: SystemDetails; review: Review } | Failure> {
  const owner = await currentOwner();
  if (!owner) return SIGNED_OUT;
  if (typeof id !== "string" || !UUID.test(id)) return { ok: false, error: "That scan was not found." };
  const system = cleanSystem(details);
  const review = cleanReview(reviewInput);
  try {
    return (await updateInventory(owner, id, system, review))
      ? { ok: true, system, review }
      : { ok: false, error: "That scan was not found." };
  } catch {
    return { ok: false, error: STORE_FAILED };
  }
}

/** Reads a sign-in provider's published signing keys. */
export async function runProviderCheck(input: unknown): Promise<{ ok: true; data: ProviderCheck } | Failure> {
  const owner = await currentOwner();
  if (!owner) return SIGNED_OUT;
  if (typeof input !== "string") return { ok: false, error: "Enter a sign-in provider's address." };
  if (rateLimited(owner, "check")) {
    return { ok: false, error: `You can run up to ${PER_MINUTE} checks a minute. Try again shortly.` };
  }
  try {
    return { ok: true, data: await checkProvider(input) };
  } catch (e) {
    if (e instanceof CheckError) return { ok: false, error: e.message };
    console.error("Provider check failed:", e);
    return { ok: false, error: "The sign-in provider could not be checked." };
  }
}