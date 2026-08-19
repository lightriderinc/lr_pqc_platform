import { NextRequest, NextResponse } from "next/server";
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdir, writeFile, rm, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import * as fs from "fs";

const execFileAsync = promisify(execFile);

const MAX_UPLOAD = 50 * 1024 * 1024;
const TIMEOUT = 300_000;

const QSEARCH_BIN = join(
  process.cwd(),
  "qsearch-service",
  process.platform === "win32" ? "qsearch.exe" : "qsearch"
);

const SINGLE_EXTS = new Set([
  ".py", ".js", ".ts", ".go", ".rs", ".cpp", ".c", ".h", ".hpp",
  ".java", ".rb", ".cs", ".yaml", ".yml", ".toml", ".json",
  ".cfg", ".conf", ".ini", ".tf", ".sh", ".pem", ".crt", ".cer",
]);

export async function POST(request: NextRequest) {
  const expectedKey = process.env.QSEARCH_API_KEY;
  if (expectedKey) {
    const incoming = request.headers.get("X-Veloce-Key");
    if (incoming !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
  }

  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }

  if (file.size > MAX_UPLOAD) {
    return NextResponse.json({ error: "File is larger than 50 MB." }, { status: 413 });
  }

  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  const isZip = ext === ".zip";
  const isSingle = SINGLE_EXTS.has(ext);

  if (!isZip && !isSingle) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a ZIP or a source file." },
      { status: 400 }
    );
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

      // Extract zip using Python (available on Vercel)
      await execFileAsync("python3", [
        "-c",
        `import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])`,
        zipPath,
        srcDir,
      ], { timeout: 30_000 });
    } else {
      await writeFile(join(srcDir, file.name), bytes);
    }

    // Make binary executable
    fs.chmodSync(QSEARCH_BIN, 0o755);

    await execFileAsync(
      QSEARCH_BIN,
      ["scan", srcDir, "--out", outDir, "--quiet"],
      { timeout: TIMEOUT }
    );

    const raw = JSON.parse(
      await readFile(join(outDir, "findings.json"), "utf8")
    );

    const findings = raw.findings ?? [];
    return NextResponse.json({
      files_scanned: raw.files_scanned ?? 0,
      quantum_vulnerable: findings.filter((f: { classification: string }) => f.classification === "quantum-vulnerable").length,
      high_risk: findings.filter((f: { risk: string }) => f.risk === "high").length,
      pqc_ready: findings.filter((f: { classification: string }) => f.classification === "pqc-ready").length,
      findings: findings.map((f: {
        algorithm: string;
        classification: string;
        risk: string;
        asset: string;
        evidence?: string;
      }) => ({
        algorithm: f.algorithm ?? "",
        classification: f.classification ?? "",
        risk: f.risk ?? "",
        asset: f.asset ?? "",
        evidence: f.evidence ?? "",
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Scan failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await rm(tmp, { recursive: true, force: true }).catch(() => {});
  }
}