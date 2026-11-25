"use client";

import { getSigningKey } from "@/app/qsearch/actions";
import Badge from "@/components/ui/Badge";
import DownloadButton from "@/components/ui/DownloadButton";
import SectionPanel from "@/components/ui/SectionPanel";
import { sha256Hex, verifySignedResult, type Statement, type Verification } from "@/lib/qsearch/attestation";
import Link from "next/link";
import { useEffect, useState } from "react";

/** Signed results are a few megabytes at most; anything larger is not one. */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

const KIND: Record<Statement["kind"], string> = {
  "code-scan": "Code scan",
  "server-check": "Server check",
  "domain-audit": "Domain audit",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-[180px_1fr]">
      <dt className="text-gray-500">{label}</dt>
      <dd className="break-all text-gray-800">{children}</dd>
    </div>
  );
}

/** A short summary of what the signed results say, by kind. */
function Summary({ kind, results }: { kind: Statement["kind"]; results: Record<string, unknown> }) {
  if (kind === "code-scan") {
    return (
      <Row label="Results">
        {String(results.files_scanned)} files scanned, {String(results.quantum_vulnerable)} quantum-vulnerable,{" "}
        {String(results.pqc_ready)} PQC-ready, {Array.isArray(results.findings) ? results.findings.length : 0} findings in all
      </Row>
    );
  }
  if (kind === "server-check") {
    return (
      <Row label="Results">
        {String(results.protocol)}, key exchange {String(results.keyExchange)}
      </Row>
    );
  }
  const s = (results.summary ?? {}) as Record<string, number>;
  return (
    <Row label="Results">
      {s.hostsChecked} hosts checked: {s.postQuantum} post-quantum, {s.classical} classical only
    </Row>
  );
}

/**
 * Checks a signed qSearch result in the browser: the ML-DSA-65 signature
 * against the published key, and that the results are unchanged. Optionally
 * checks that a file is the exact upload that was scanned.
 */
export default function VerifyResult() {
  const [key, setKey] = useState<{ keyId: string; publicKey: string } | null | undefined>(undefined);
  const [check, setCheck] = useState<(Verification & { results: Record<string, unknown> }) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [original, setOriginal] = useState<{ name: string; matches: boolean } | null>(null);

  useEffect(() => {
    getSigningKey().then(setKey, () => setKey(null));
  }, []);

  async function readSigned(file: File) {
    setError(null);
    setCheck(null);
    setOriginal(null);
    if (!key) return;
    if (file.size > MAX_FILE_BYTES) return setError("This file is too large to be a signed qSearch result.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      return setError("This file is not JSON, so it cannot be a signed qSearch result.");
    }
    const publicKey = Uint8Array.from(atob(key.publicKey), (c) => c.charCodeAt(0));
    const results = ((parsed as { results?: unknown })?.results ?? {}) as Record<string, unknown>;
    setCheck({ ...verifySignedResult(parsed, publicKey), results });
  }

  async function readOriginal(file: File) {
    const subject = check?.statement?.subject;
    if (!subject?.uploadSha256) return;
    const digest = sha256Hex(new Uint8Array(await file.arrayBuffer()));
    setOriginal({ name: file.name, matches: digest === subject.uploadSha256 });
  }

  const s = check?.statement;
  return (
    <div className="animate-fade-in-up space-y-8">
      <div className="space-y-2">
        <Link href="/qsearch" className="text-sm underline">
          ← qSearch
        </Link>
        <h1 className="text-2xl font-semibold">Verify a signed result</h1>
        <p className="text-sm text-gray-600">
          qSearch signs every scan, server check and domain audit it produces with ML-DSA-65, a post-quantum signature
          (FIPS 204). Checking happens here in your browser, against the public key below: nothing you choose is uploaded.
        </p>
      </div>

      <SectionPanel title="Check a file">
        {key === undefined && <p className="text-sm text-gray-500">Loading the public key…</p>}
        {key === null && <p className="text-sm text-red-600">Signing is not set up on this server, so results cannot be checked here.</p>}
        {key && (
          <div className="space-y-4">
            <label className="block space-y-1 text-sm">
              <span className="font-medium text-gray-700">Signed result (.json)</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={(e) => e.target.files?.[0] && readSigned(e.target.files[0])}
                className="block text-sm"
              />
            </label>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            {check && (
              <div className="default-radius space-y-3 border border-gray-100 bg-white p-4 text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant={check.valid ? "ready" : "vulnerable"}>{check.valid ? "Valid" : "Not valid"}</Badge>
                  <span className="text-gray-700">
                    {check.valid
                      ? "Signed by qSearch, and unchanged since it was signed."
                      : check.problem}
                  </span>
                </div>
                {s && (
                  <dl className="space-y-1">
                    <Row label="Kind">{KIND[s.kind] ?? s.kind}</Row>
                    <Row label="Signed">{new Date(s.issuedAt).toLocaleString()}</Row>
                    {"fileName" in s.subject && <Row label="Upload">{String(s.subject.fileName)}</Row>}
                    {"uploadSha256" in s.subject && <Row label="Upload SHA-256">{String(s.subject.uploadSha256)}</Row>}
                    {"scanner" in s.subject && <Row label="Scanner">{String(s.subject.scanner)}</Row>}
                    {"host" in s.subject && <Row label="Server">{`${s.subject.host}:${s.subject.port}`}</Row>}
                    {"domain" in s.subject && (
                      <Row label="Domain">
                        {String(s.subject.domain)} {s.subject.verified ? "(ownership verified)" : "(not verified: counts only)"}
                      </Row>
                    )}
                    {check.resultsUnchanged && <Summary kind={s.kind} results={check.results} />}
                    <Row label="Key ID">{s.keyId}</Row>
                  </dl>
                )}
                {check.valid && s?.subject.uploadSha256 && (
                  <label className="block space-y-1 border-t border-gray-100 pt-3">
                    <span className="font-medium text-gray-700">
                      Optional: check that a file is the exact upload that was scanned
                    </span>
                    <input type="file" onChange={(e) => e.target.files?.[0] && readOriginal(e.target.files[0])} className="block" />
                    {original && (
                      <span className={`block ${original.matches ? "text-green-700" : "text-red-700"}`}>
                        {original.matches
                          ? `${original.name} is the exact file that was scanned.`
                          : `${original.name} is not the file that was scanned: its SHA-256 is different.`}
                      </span>
                    )}
                  </label>
                )}
              </div>
            )}
          </div>
        )}
      </SectionPanel>

      {key && (
        <SectionPanel title="Public key">
          <dl className="space-y-1 text-sm">
            <Row label="Algorithm">ML-DSA-65 (FIPS 204)</Row>
            <Row label="Key ID">{key.keyId}</Row>
          </dl>
          <div className="mt-4 flex justify-end">
            <DownloadButton
              label="Public key (base64)"
              value={key.publicKey}
              filename={`qsearch-signing-key-${key.keyId}.txt`}
              mimeType="text/plain"
            />
          </div>
        </SectionPanel>
      )}
    </div>
  );
}