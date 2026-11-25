// The signing key for attestations. Server only: the secret key never leaves
// the server. It is derived from QSEARCH_SIGNING_SEED (32 random bytes, hex),
// so the same seed always gives the same key; rotating means a new seed and
// publishing the new public key.

import { ml_dsa65 } from "@noble/post-quantum/ml-dsa.js";
import {
  ALGORITHM,
  ISSUER,
  canonicalJson,
  keyIdOf,
  sha256Hex,
  statementBytes,
  type Attestation,
  type AttestationKind,
  type SignedResult,
  type Statement,
} from "./attestation";

let cached: { publicKey: Uint8Array; secretKey: Uint8Array; keyId: string } | null | undefined;

function signingKey() {
  if (cached !== undefined) return cached;
  let seedHex = process.env.QSEARCH_SIGNING_SEED ?? "";
  if (!/^[0-9a-f]{64}$/i.test(seedHex)) {
    if (process.env.NODE_ENV === "production") {
      if (seedHex) console.error("QSEARCH_SIGNING_SEED must be 64 hex characters; results will not be signed.");
      return (cached = null);
    }
    console.warn("QSEARCH_SIGNING_SEED is not set; signing with a development-only key.");
    seedHex = "d".repeat(64);
  }
  const seed = Uint8Array.from(seedHex.match(/../g)!, (h) => parseInt(h, 16));
  const { publicKey, secretKey } = ml_dsa65.keygen(seed);
  return (cached = { publicKey, secretKey, keyId: keyIdOf(publicKey) });
}

/** The published public key, or null when signing is not set up. */
export function signingPublicKey(): { keyId: string; publicKey: string } | null {
  const key = signingKey();
  return key ? { keyId: key.keyId, publicKey: Buffer.from(key.publicKey).toString("base64") } : null;
}

/** Signs results the server produced; null when signing is not set up. */
export function signResult<T>(
  kind: AttestationKind,
  subject: Statement["subject"],
  results: T,
): SignedResult<T> | null {
  const key = signingKey();
  if (!key) return null;
  const statement: Statement = {
    v: 1,
    issuer: ISSUER,
    algorithm: ALGORITHM,
    kind,
    issuedAt: new Date().toISOString(),
    keyId: key.keyId,
    subject,
    resultsSha256: sha256Hex(canonicalJson(results)),
  };
  const signature = Buffer.from(ml_dsa65.sign(statementBytes(statement), key.secretKey)).toString("base64");
  const attestation: Attestation = { statement, signature };
  return { qsearchSignedResult: 1, attestation, results };
}