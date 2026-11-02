// Token Forgery Check: logic only. Settings and all text live in jwtConfig.ts.
//
// Everything runs in the browser. Tokens and keys are never sent anywhere.
// Classical signatures are verified with `jose`. ML-DSA tokens are signed and
// verified with @noble/post-quantum, which matches the RFC 9964 test vectors.

import { randomBytes } from "@noble/hashes/utils.js";
import { ml_dsa44, ml_dsa65, ml_dsa87 } from "@noble/post-quantum/ml-dsa.js";
import * as jose from "jose";
import {
  JWE_ALGORITHMS,
  JWS_ALGORITHMS,
  LOCALE,
  MAX_TOKEN_CHARS,
  ML_DSA_LEVELS,
  SAMPLE,
  SIZE_LIMITS,
  TEXT,
  TIME_CLAIMS,
  UNKNOWN_ALG,
  type AlgInfo,
  type MlDsaLevel,
  type SampleAlgorithm,
  type SizeLimit,
} from "./jwtConfig";

/** Error with a message that is safe to show to the user. */
export class JwtError extends Error {}

const E = TEXT.errors;
const ML_DSA = { "ML-DSA-44": ml_dsa44, "ML-DSA-65": ml_dsa65, "ML-DSA-87": ml_dsa87 };
const isMlDsa = (alg: string): alg is MlDsaLevel => (ML_DSA_LEVELS as readonly string[]).includes(alg);

const B64URL = /^[A-Za-z0-9_-]*$/;
const encoder = new TextEncoder();

function decodeSegment(segment: string, what: string): Uint8Array {
  if (!B64URL.test(segment)) throw new JwtError(E.badChars(what));
  try {
    return jose.base64url.decode(segment);
  } catch {
    throw new JwtError(E.badBase64(what));
  }
}

function decodeJson(segment: string, what: string): Record<string, unknown> {
  try {
    const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(decodeSegment(segment, what)));
    if (value && typeof value === "object" && !Array.isArray(value)) return value;
  } catch (e) {
    if (e instanceof JwtError) throw e;
  }
  throw new JwtError(E.notJson(what));
}

/* ---------- decode ---------- */

export type Decoded =
  | {
      kind: "signed";
      token: string;
      alg: string;
      header: Record<string, unknown>;
      /** Parsed JSON when the payload is JSON, otherwise the raw text. */
      payload: Record<string, unknown> | string;
      payloadSegment: string;
      signatureBytes: number;
    }
  | { kind: "encrypted"; token: string; alg: string; header: Record<string, unknown> };

export function decodeToken(input: string): Decoded {
  const token = input.trim().replace(/^Bearer\s+/i, "");
  if (!token) throw new JwtError(E.empty);
  if (token.length > MAX_TOKEN_CHARS) throw new JwtError(E.tooLong);

  const parts = token.split(".");
  if (parts.length === 5) {
    const header = decodeJson(parts[0], "header");
    return { kind: "encrypted", token, alg: String(header.alg ?? ""), header };
  }
  if (parts.length !== 3) throw new JwtError(E.parts);

  const header = decodeJson(parts[0], "header");
  if (typeof header.alg !== "string") throw new JwtError(E.noAlg);

  let payload: Record<string, unknown> | string;
  try {
    payload = decodeJson(parts[1], "payload");
  } catch {
    payload = new TextDecoder().decode(decodeSegment(parts[1], "payload"));
  }

  return {
    kind: "signed",
    token,
    alg: header.alg,
    header,
    payload,
    payloadSegment: parts[1],
    signatureBytes: decodeSegment(parts[2], "signature").length,
  };
}

export function algorithmInfo(decoded: Decoded): AlgInfo {
  const table = decoded.kind === "signed" ? JWS_ALGORITHMS : JWE_ALGORITHMS;
  return Object.hasOwn(table, decoded.alg) ? table[decoded.alg] : UNKNOWN_ALG;
}

/* ---------- times ---------- */

export interface TimeClaim {
  label: string;
  date: Date;
}

const claimMs = (payload: Record<string, unknown>, claim: string): number | null =>
  typeof payload[claim] === "number" && Number.isFinite(payload[claim]) ? (payload[claim] as number) * 1000 : null;

export function timeClaims(payload: Record<string, unknown> | string): TimeClaim[] {
  if (typeof payload === "string") return [];
  return Object.entries(TIME_CLAIMS)
    .map(([claim, label]) => ({ label, ms: claimMs(payload, claim) }))
    .filter((c): c is { label: string; ms: number } => c.ms !== null)
    .map((c) => ({ label: c.label, date: new Date(c.ms) }));
}

/** "in 54 minutes", "3 days ago", using the largest unit that fits. */
export function relativeTime(targetMs: number, nowMs: number): string {
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
    ["second", 1000],
  ];
  const diff = targetMs - nowMs;
  const fmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: "auto" });
  for (const [unit, size] of units) {
    if (Math.abs(diff) >= size || unit === "second") return fmt.format(Math.round(diff / size), unit);
  }
  return "";
}

export type ExpiryState = "expired" | "valid" | "notYet" | "none";

/** Whether the token is usable right now, from its own nbf and exp claims. */
export function expiryStatus(payload: Record<string, unknown> | string, nowMs: number): { state: ExpiryState; text: string } {
  if (typeof payload === "string") return { state: "none", text: TEXT.expiry.none };
  const nbf = claimMs(payload, "nbf");
  const exp = claimMs(payload, "exp");
  if (nbf !== null && nbf > nowMs) return { state: "notYet", text: TEXT.expiry.notYet(relativeTime(nbf, nowMs)) };
  if (exp === null) return { state: "none", text: TEXT.expiry.none };
  return exp <= nowMs
    ? { state: "expired", text: TEXT.expiry.expired(relativeTime(exp, nowMs)) }
    : { state: "valid", text: TEXT.expiry.valid(relativeTime(exp, nowMs)) };
}

/* ---------- sizes ---------- */

export interface SizeCheck {
  id: SizeLimit["id"];
  label: string;
  fits: boolean;
  /** Positive when the token is too big, negative when there is room left. */
  overBy: number;
  consequence: string;
  source: string;
}

export function sizeChecks(token: string): SizeCheck[] {
  const bytes = encoder.encode(token).length;
  return SIZE_LIMITS.map((l) => {
    const overBy = encoder.encode(l.prefix).length + bytes - l.maxBytes;
    return { id: l.id, label: l.label, fits: overBy <= 0, overBy, consequence: l.consequence, source: l.source };
  });
}

/* ---------- verify ---------- */

export type VerifyResult = { valid: true } | { valid: false; reason: string };

type ClassicalKey = Uint8Array | CryptoKey | jose.JWTVerifyGetKey;

async function importClassicalKey(alg: string, keyText: string, kid: unknown): Promise<ClassicalKey> {
  const text = keyText.trim();
  if (alg.startsWith("HS")) return encoder.encode(keyText);
  let json: unknown = null;
  if (text.startsWith("{")) {
    try {
      json = JSON.parse(text);
    } catch {
      throw new JwtError(E.keyFormat);
    }
  }
  // A key set ({"keys": [...]}, such as Google's certs page): pick the key
  // whose kid matches the token's, the same way a real server does.
  if (json && typeof json === "object" && Array.isArray((json as { keys?: unknown }).keys)) {
    if (typeof kid !== "string") throw new JwtError(E.noKid);
    return jose.createLocalJWKSet(json as jose.JSONWebKeySet);
  }
  try {
    if (json) return (await jose.importJWK(json as jose.JWK, alg)) as CryptoKey;
    if (text.includes("BEGIN CERTIFICATE")) return await jose.importX509(text, alg);
    if (text.includes("BEGIN PUBLIC KEY")) return await jose.importSPKI(text, alg);
  } catch {
    throw new JwtError(E.keyUnusable(alg));
  }
  throw new JwtError(E.keyFormat);
}

function mlDsaPublicKey(alg: MlDsaLevel, keyText: string): Uint8Array {
  let jwk: Record<string, unknown>;
  try {
    jwk = JSON.parse(keyText);
  } catch {
    throw new JwtError(E.mlDsaJwk);
  }
  if (jwk.kty !== "AKP" || jwk.alg !== alg || typeof jwk.pub !== "string") throw new JwtError(E.mlDsaJwkFields(alg));
  const pub = decodeSegment(jwk.pub, "public key");
  if (pub.length !== ML_DSA[alg].lengths.publicKey) throw new JwtError(E.keyLength);
  return pub;
}

export async function verifyToken(decoded: Decoded, keyText: string): Promise<VerifyResult> {
  if (decoded.kind !== "signed") throw new JwtError(E.encryptedVerify);
  if (!keyText.trim()) throw new JwtError(E.noKey);
  const { alg, token } = decoded;
  if (alg === "none") return { valid: false, reason: E.noSignature };
  if (!Object.hasOwn(JWS_ALGORITHMS, alg)) throw new JwtError(E.unsupported(alg));

  if (isMlDsa(alg)) {
    const [h, p, s] = token.split(".");
    const ok = ML_DSA[alg].verify(decodeSegment(s, "signature"), encoder.encode(`${h}.${p}`), mlDsaPublicKey(alg, keyText));
    return ok ? { valid: true } : { valid: false, reason: E.mismatch };
  }

    const key = await importClassicalKey(alg, keyText, decoded.header.kid);
  try {
    if (typeof key === "function") await jose.compactVerify(token, key, { algorithms: [alg] });
    else await jose.compactVerify(token, key, { algorithms: [alg] });
    return { valid: true };
  } catch (e) {
    if (e instanceof jose.errors.JWSSignatureVerificationFailed) return { valid: false, reason: E.mismatch };
    if (e instanceof jose.errors.JWKSNoMatchingKey) return { valid: false, reason: E.noMatchingKey(String(decoded.header.kid)) };
    return { valid: false, reason: E.checkFailed };
  }
}

/* ---------- sample token ---------- */

export interface SampleToken {
  token: string;
  /** The verification key: a PEM public key, or the HS256 secret. */
  keyText: string;
}

/**
 * A real token, signed in the browser with a key made for it. The claims come
 * from SAMPLE in the config, with iat and exp set from the current time.
 */
export async function makeSampleToken(alg: SampleAlgorithm, nowMs: number): Promise<SampleToken> {
  const iat = Math.floor(nowMs / 1000);
  const jwt = new jose.SignJWT({ ...SAMPLE.claims })
    .setProtectedHeader({ alg, typ: "JWT" })
    .setIssuedAt(iat)
    .setExpirationTime(iat + SAMPLE.lifetimeSeconds);
  try {
    if (alg.startsWith("HS")) {
      const secret = jose.base64url.encode(randomBytes(SAMPLE.hmacSecretBytes));
      return { token: await jwt.sign(encoder.encode(secret)), keyText: secret };
    }
    const { publicKey, privateKey } = await jose.generateKeyPair(alg, { extractable: true });
    return { token: await jwt.sign(privateKey), keyText: await jose.exportSPKI(publicKey) };
  } catch {
    throw new JwtError(E.sampleFailed(alg));
  }
}

/* ---------- ML-DSA versions ---------- */

export interface MlDsaVersion {
  alg: MlDsaLevel;
  token: string;
  publicJwk: string;
  verified: boolean;
  sizes: SizeCheck[];
}

/**
 * Signs the same payload bytes with each ML-DSA level, using a fresh key, and
 * verifies the result. The original header is kept except for alg and kid.
 */
export async function mlDsaVersions(decoded: Decoded): Promise<MlDsaVersion[]> {
  if (decoded.kind !== "signed") throw new JwtError(E.onlySigned);
  const results: MlDsaVersion[] = [];
  for (const alg of ML_DSA_LEVELS) {
    const scheme = ML_DSA[alg];
    const { publicKey, secretKey } = scheme.keygen();
    const jwk = { kty: "AKP", alg, pub: jose.base64url.encode(publicKey) };
    const kid = await jose.calculateJwkThumbprint(jwk);
    const header = jose.base64url.encode(JSON.stringify({ ...decoded.header, alg, kid }));
    const input = encoder.encode(`${header}.${decoded.payloadSegment}`);
    const signature = scheme.sign(input, secretKey);
    secretKey.fill(0);
    const token = `${header}.${decoded.payloadSegment}.${jose.base64url.encode(signature)}`;
    results.push({
      alg,
      token,
      publicJwk: JSON.stringify({ ...jwk, kid }, null, 2),
      verified: scheme.verify(signature, input, publicKey),
      sizes: sizeChecks(token),
    });
  }
  return results;
}

/** Which ML-DSA versions of this token fit in a cookie, from their measured sizes. */
export function cookieFit(versions: MlDsaVersion[]): { fit: string[]; noFit: string[] } {
  const fitsCookie = (v: MlDsaVersion) => v.sizes.find((s) => s.id === "cookie")?.fits ?? false;
  return {
    fit: versions.filter(fitsCookie).map((v) => v.alg),
    noFit: versions.filter((v) => !fitsCookie(v)).map((v) => v.alg),
  };
}