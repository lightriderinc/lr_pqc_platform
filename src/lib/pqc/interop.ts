// Interop Challenge: logic only. Settings and all text live in interopConfig.ts.
//
// Tests someone else's ML-KEM or ML-DSA implementation against fresh random
// challenges. Each challenge is generated when it is created and kept only in
// memory. A response passes only when the user's implementation produces a
// result that the standard requires: matching shared secrets, a signature
// that verifies, or the correct choice between a valid and a decoy signature.

import { bytesToHex, hexToBytes, randomBytes } from "@noble/hashes/utils.js";
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import { ml_kem1024, ml_kem512, ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import {
  CHALLENGE_FORMAT,
  CONTEXT_BYTES,
  MESSAGE_BYTES,
  TESTS,
  TEXT,
  type DsaSet,
  type KemSet,
} from "./interopConfig";

/** Error with a message that is safe to show to the user. */
export class InteropError extends Error {}

const E = TEXT.errors;
const KEM = { "ML-KEM-512": ml_kem512, "ML-KEM-768": ml_kem768, "ML-KEM-1024": ml_kem1024 };
const DSA = { "ML-DSA-44": ml_dsa44, "ML-DSA-65": ml_dsa65, "ML-DSA-87": ml_dsa87 };

export interface CheckResult {
  ok: boolean;
  detail: string;
}

/* ---------- reading responses ---------- */

function parseResponse(text: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object" && !Array.isArray(v)) return v;
  } catch {
    /* handled below */
  }
  throw new InteropError(E.notJson);
}

/** Reads one hex field and checks its length against the standard's size. */
function hexField(obj: Record<string, unknown>, field: string, wantBytes: number): Uint8Array {
  const value = obj[field];
  if (typeof value !== "string") throw new InteropError(E.missing(field));
  const clean = value.trim();
  if (!/^([0-9a-fA-F]{2})*$/.test(clean)) throw new InteropError(E.notHex(field));
  const bytes = hexToBytes(clean);
  if (bytes.length !== wantBytes) throw new InteropError(E.wrongLength(field, wantBytes, bytes.length));
  return bytes;
}

function same(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Turns a parsing problem into a failed result with its message. */
function checked(fn: () => CheckResult): CheckResult {
  try {
    return fn();
  } catch (e) {
    if (e instanceof InteropError) return { ok: false, detail: e.message };
    return { ok: false, detail: E.generic };
  }
}

const show = (obj: object) => JSON.stringify({ format: CHALLENGE_FORMAT, ...obj }, null, 2);

/* ---------- 1. the user encapsulates ---------- */

export interface EncapsChallenge {
  alg: KemSet;
  secretKey: Uint8Array;
  /** JSON the user's code reads. */
  text: string;
}

export function newEncapsChallenge(alg: KemSet): EncapsChallenge {
  const { publicKey, secretKey } = KEM[alg].keygen();
  return { alg, secretKey, text: show({ test: TESTS.encaps, alg, publicKey: bytesToHex(publicKey) }) };
}

/** Decapsulates the user's ciphertext and compares the result with the secret they report. */
export function checkEncaps(ch: EncapsChallenge, responseText: string): CheckResult {
  return checked(() => {
    const r = parseResponse(responseText);
    const kem = KEM[ch.alg];
    const ct = hexField(r, "cipherText", kem.lengths.cipherText!);
    const theirs = hexField(r, "sharedSecret", 32);
    const ours = kem.decapsulate(ct, ch.secretKey);
    return same(ours, theirs) ? { ok: true, detail: TEXT.results.encapsOk(ch.alg) } : { ok: false, detail: TEXT.results.secretMismatch };
  });
}

/* ---------- 2. the user decapsulates ---------- */

/** First step: the request the user's code answers with a new public key. */
export function keyRequest(alg: KemSet): string {
  return show({ test: TESTS.keygen, alg });
}

export interface DecapsChallenge {
  alg: KemSet;
  sharedSecret: Uint8Array;
  text: string;
}

/** Second step: encapsulates to the user's public key. */
export function newDecapsChallenge(alg: KemSet, responseText: string): DecapsChallenge {
  const r = parseResponse(responseText);
  const pk = hexField(r, "publicKey", KEM[alg].lengths.publicKey!);
  const { cipherText, sharedSecret } = KEM[alg].encapsulate(pk);
  return { alg, sharedSecret, text: show({ test: TESTS.decaps, alg, cipherText: bytesToHex(cipherText) }) };
}

export function checkDecaps(ch: DecapsChallenge, responseText: string): CheckResult {
  return checked(() => {
    const theirs = hexField(parseResponse(responseText), "sharedSecret", 32);
    return same(ch.sharedSecret, theirs) ? { ok: true, detail: TEXT.results.decapsOk(ch.alg) } : { ok: false, detail: TEXT.results.secretMismatch };
  });
}

/* ---------- 3. the user signs ---------- */

export interface SignChallenge {
  alg: DsaSet;
  message: Uint8Array;
  context: Uint8Array;
  text: string;
}

export function newSignChallenge(alg: DsaSet): SignChallenge {
  const message = randomBytes(MESSAGE_BYTES);
  const context = randomBytes(CONTEXT_BYTES);
  return {
    alg,
    message,
    context,
    text: show({ test: TESTS.sign, alg, message: bytesToHex(message), context: bytesToHex(context) }),
  };
}

export function checkSign(ch: SignChallenge, responseText: string): CheckResult {
  return checked(() => {
    const r = parseResponse(responseText);
    const dsa = DSA[ch.alg];
    const pk = hexField(r, "publicKey", dsa.lengths.publicKey!);
    const sig = hexField(r, "signature", dsa.lengths.signature!);
    let valid: boolean;
    try {
      valid = dsa.verify(sig, ch.message, pk, { context: ch.context });
    } catch {
      valid = false;
    }
    return valid ? { ok: true, detail: TEXT.results.signOk(ch.alg) } : { ok: false, detail: TEXT.results.signatureInvalid };
  });
}

/* ---------- 4. the user verifies ---------- */

export interface VerifyChallenge {
  alg: DsaSet;
  validIndex: 0 | 1;
  text: string;
}

/**
 * Two genuine signatures from the same key: one over this message, one over a
 * different random message. Their order is random. Only an implementation
 * that really verifies can pick the right one every time.
 */
export function newVerifyChallenge(alg: DsaSet): VerifyChallenge {
  const dsa = DSA[alg];
  const { publicKey, secretKey } = dsa.keygen();
  const message = randomBytes(MESSAGE_BYTES);
  const context = randomBytes(CONTEXT_BYTES);
  const valid = dsa.sign(message, secretKey, { context });
  const decoy = dsa.sign(randomBytes(MESSAGE_BYTES), secretKey, { context });
  secretKey.fill(0);
  const validIndex = (randomBytes(1)[0] & 1) as 0 | 1;
  const signatures = validIndex === 0 ? [valid, decoy] : [decoy, valid];
  return {
    alg,
    validIndex,
    text: show({
      test: TESTS.verify,
      alg,
      publicKey: bytesToHex(publicKey),
      message: bytesToHex(message),
      context: bytesToHex(context),
      signatures: signatures.map(bytesToHex),
    }),
  };
}

export function checkVerify(ch: VerifyChallenge, responseText: string): CheckResult {
  return checked(() => {
    const index = parseResponse(responseText).validIndex;
    if (index !== 0 && index !== 1) throw new InteropError(E.badIndex);
    return index === ch.validIndex ? { ok: true, detail: TEXT.results.verifyOk(ch.alg) } : { ok: false, detail: TEXT.results.wrongPick };
  });
}