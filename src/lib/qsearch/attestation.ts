// Signed results ("attestations"): proof that qSearch produced a result, and
// that it has not been changed since.
//
// The server signs only what it produced itself: a scan's findings, a server
// check, a domain audit. Each signature covers a short statement (what was
// checked, when, by which key) and the SHA-256 of the exact results, so
// changing a single finding breaks it. Reports a person edits, such as the
// inventory, are not signed.
//
// Pure: verification runs in the browser with the published public key, so
// checking a result needs no trust in Light Rider's server.

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

export const ISSUER = "qSearch (Light Rider)";
export const ALGORITHM = "ML-DSA-65";

export type AttestationKind = "code-scan" | "server-check" | "domain-audit";

export interface Statement {
  v: 1;
  issuer: typeof ISSUER;
  algorithm: typeof ALGORITHM;
  kind: AttestationKind;
  issuedAt: string;
  /** First 16 hex characters of the SHA-256 of the public key. */
  keyId: string;
  /** What was checked: an upload's name and hash, a host, a domain. */
  subject: Record<string, string | number | boolean>;
  /** SHA-256 of the canonical JSON of the results. */
  resultsSha256: string;
}

export interface Attestation {
  statement: Statement;
  /** Base64 ML-DSA-65 signature over the canonical JSON of the statement. */
  signature: string;
}

/** A signed download: the attestation and the results it covers. */
export interface SignedResult<T = unknown> {
  qsearchSignedResult: 1;
  attestation: Attestation;
  results: T;
}

/** JSON with object keys sorted at every level, so the same data always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    if (typeof value === "number" && !Number.isFinite(value)) return "null";
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) return `[${value.map((v) => (v === undefined ? "null" : canonicalJson(v))).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
}

const encoder = new TextEncoder();

export const sha256Hex = (data: Uint8Array | string) =>
  bytesToHex(sha256(typeof data === "string" ? encoder.encode(data) : data));

export const keyIdOf = (publicKey: Uint8Array) => sha256Hex(publicKey).slice(0, 16);

/** The exact bytes that are signed. */
export const statementBytes = (s: Statement) => encoder.encode(canonicalJson(s));

const fromBase64 = (b64: string) => {
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export interface Verification {
  /** All checks passed. */
  valid: boolean;
  signatureValid: boolean;
  resultsUnchanged: boolean;
  /** The result was signed with the key given for checking. */
  knownKey: boolean;
  statement: Statement | null;
  /** Plain-language reason when not valid. */
  problem: string | null;
}

/** Checks a signed result against a public key. Never throws. */
export function verifySignedResult(file: unknown, publicKey: Uint8Array): Verification {
  const fail = (problem: string, statement: Statement | null = null): Verification => ({
    valid: false,
    signatureValid: false,
    resultsUnchanged: false,
    knownKey: false,
    statement,
    problem,
  });
  const f = file as Partial<SignedResult>;
  if (!f || typeof f !== "object" || f.qsearchSignedResult !== 1 || !f.attestation?.statement || "results" in f === false) {
    return fail("This is not a signed qSearch result.");
  }
  const { statement, signature } = f.attestation;
  if (statement.v !== 1 || statement.algorithm !== ALGORITHM || typeof signature !== "string") {
    return fail("This signed result uses a format this page does not know.", statement);
  }
  const knownKey = statement.keyId === keyIdOf(publicKey);
  let signatureValid = false;
  try {
    signatureValid = knownKey && ml_dsa65.verify(fromBase64(signature), statementBytes(statement), publicKey);
  } catch {
    signatureValid = false;
  }
  const resultsUnchanged = sha256Hex(canonicalJson(f.results)) === statement.resultsSha256;
  const problem = !knownKey
    ? "It was signed with a different key from the one published here (an older key, or not from qSearch)."
    : !signatureValid
      ? "The signature does not match: the statement was changed, or it was not signed by qSearch."
      : !resultsUnchanged
        ? "The signature is genuine, but the results were changed after signing."
        : null;
  return { valid: problem === null, signatureValid, resultsUnchanged, knownKey, statement, problem };
}