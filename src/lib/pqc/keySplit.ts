// Secret Split: logic only. Settings and all text live in keySplitConfig.ts.
//
// A secret is protected so that any `threshold` of `total` custodians can
// recover it, and fewer than `threshold` cannot open or read it.
//
//   1. The secret is padded to a fixed block size, so a share does not reveal
//      its exact length, then encrypted with a random 32-byte data key
//      (AES-256-GCM).
//   2. The data key is split with Shamir secret sharing (audited library).
//   3. Each piece is encrypted to one custodian's X-Wing public key
//      (X25519 + ML-KEM-768, draft-connolly-cfrg-xwing-kem).
//   4. Each custodian receives one share file with their encrypted piece and
//      a copy of the encrypted secret.
//
// AES-GCM authenticates every layer, so wrong, mixed, or edited files fail
// with a clear error. Everything runs in the browser.

import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { XWing } from "@noble/post-quantum/hybrid.js";
import { combine, split } from "shamir-secret-sharing";
import {
  ALGORITHMS,
  DATA_KEY_BYTES,
  FILE_TYPES,
  FINGERPRINT_BYTES,
  FORMAT_VERSION,
  HKDF_INFO,
  KEYSPLIT_LIMITS,
  LENGTH_PREFIX_BYTES,
  NONCE_BYTES,
  PAD_BLOCK_BYTES,
  PRACTICE,
  PUBLIC_KEY_PREFIX,
  READABLE_VERSIONS,
  TEXT,
} from "./keySplitConfig";

/** Error with a message that is safe to show to the user. */
export class KeySplitError extends Error {}

const E = TEXT.errors;

/* ---------- encoding ---------- */

function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(text: string, what: string): Uint8Array {
  try {
    const s = atob(text.replace(/-/g, "+").replace(/_/g, "/").replace(/\s/g, ""));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  } catch {
    throw new KeySplitError(E.badEncoding(what));
  }
}

const toBase64Url = (b: Uint8Array) => toBase64(b).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Short, human-checkable fingerprint of a public key, e.g. "3fa1 09c2 ...". */
export function fingerprint(publicKey: Uint8Array): string {
  return bytesToHex(sha256(publicKey).subarray(0, FINGERPRINT_BYTES)).match(/.{4}/g)!.join(" ");
}

function keyId(publicKey: Uint8Array): string {
  return bytesToHex(sha256(publicKey).subarray(0, FINGERPRINT_BYTES));
}

/* ---------- padding ---------- */

/** length (4 bytes, big-endian) + secret + zeros, up to a multiple of PAD_BLOCK_BYTES. */
export function pad(secret: Uint8Array): Uint8Array {
  const used = LENGTH_PREFIX_BYTES + secret.length;
  const out = new Uint8Array(Math.ceil(used / PAD_BLOCK_BYTES) * PAD_BLOCK_BYTES);
  new DataView(out.buffer).setUint32(0, secret.length);
  out.set(secret, LENGTH_PREFIX_BYTES);
  return out;
}

export function unpad(padded: Uint8Array): Uint8Array {
  const len = new DataView(padded.buffer, padded.byteOffset, padded.byteLength).getUint32(0);
  if (LENGTH_PREFIX_BYTES + len > padded.length) throw new KeySplitError(E.notRebuilt);
  return padded.slice(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + len);
}

/* ---------- file formats ---------- */

export interface CustodianKeyFile {
  type: typeof FILE_TYPES.custodianKey;
  version: number;
  name: string;
  keyId: string;
  algorithm: string;
  publicKey: string;
  secretKey: string;
  createdAt: string;
}

export interface ShareFile {
  type: typeof FILE_TYPES.share;
  version: number;
  splitId: string;
  label: string;
  threshold: number;
  total: number;
  index: number;
  custodian: { name: string; keyId: string };
  algorithms: typeof ALGORITHMS;
  kemCipherText: string;
  share: { nonce: string; cipherText: string };
  payload: { nonce: string; cipherText: string };
  createdAt: string;
}

/** Fields that bind every share to its split. Changing any of them breaks decryption. */
function splitHeader(s: Pick<ShareFile, "version" | "splitId" | "label" | "threshold" | "total">) {
  return utf8ToBytes(JSON.stringify([FILE_TYPES.share, s.version, s.splitId, s.label, s.threshold, s.total]));
}

function shareAad(header: Uint8Array, index: number, kid: string) {
  return new Uint8Array([...header, ...utf8ToBytes(`|${index}|${kid}`)]);
}

function wrapKey(sharedSecret: Uint8Array, splitId: string, index: number) {
  return hkdf(sha256, sharedSecret, utf8ToBytes(splitId), utf8ToBytes(`${HKDF_INFO}|share|${index}`), DATA_KEY_BYTES);
}

/* ---------- custodian keys ---------- */

export interface GeneratedCustodian {
  file: CustodianKeyFile;
  publicKeyText: string;
  fingerprint: string;
}

export function generateCustodianKey(name: string): GeneratedCustodian {
  const clean = name.trim();
  if (!clean) throw new KeySplitError(E.noName);
  const { publicKey, secretKey } = XWing.keygen();
  return {
    file: {
      type: FILE_TYPES.custodianKey,
      version: FORMAT_VERSION,
      name: clean,
      keyId: keyId(publicKey),
      algorithm: ALGORITHMS.kem,
      publicKey: toBase64(publicKey),
      secretKey: toBase64(secretKey),
      createdAt: new Date().toISOString(),
    },
    publicKeyText: PUBLIC_KEY_PREFIX + toBase64Url(publicKey),
    fingerprint: fingerprint(publicKey),
  };
}

/** Real keys for the practice custodians named in the config. */
export function practiceCustodians(): GeneratedCustodian[] {
  return PRACTICE.names.map(generateCustodianKey);
}

/** Reads a pasted public key. Accepts the text with or without its prefix. */
export function parsePublicKey(text: string): Uint8Array {
  const trimmed = text.trim();
  const raw = trimmed.startsWith(PUBLIC_KEY_PREFIX) ? trimmed.slice(PUBLIC_KEY_PREFIX.length) : trimmed;
  if (!raw) throw new KeySplitError(E.noPublicKey);
  const pk = fromBase64(raw, "public key");
  if (pk.length !== XWing.lengths.publicKey) throw new KeySplitError(E.wrongKeyLength);
  return pk;
}

/* ---------- split ---------- */

export interface CustodianInput {
  name: string;
  publicKeyText: string;
}

export interface SplitInput {
  label: string;
  secret: string;
  threshold: number;
  custodians: CustodianInput[];
}

export async function splitSecret(input: SplitInput): Promise<ShareFile[]> {
  const { minCustodians, maxCustodians, maxSecretBytes, maxLabelChars } = KEYSPLIT_LIMITS;
  const label = input.label.trim();
  const secretBytes = utf8ToBytes(input.secret.normalize("NFKC"));
  const n = input.custodians.length;

  if (!label) throw new KeySplitError(E.noLabel);
  if (label.length > maxLabelChars) throw new KeySplitError(E.labelTooLong(maxLabelChars));
  if (secretBytes.length === 0) throw new KeySplitError(E.noSecret);
  if (secretBytes.length > maxSecretBytes) throw new KeySplitError(E.secretTooLarge(maxSecretBytes / 1024));
  if (n < minCustodians || n > maxCustodians) throw new KeySplitError(E.custodianCount(minCustodians, maxCustodians));
  if (!Number.isInteger(input.threshold) || input.threshold < minCustodians || input.threshold > n) {
    throw new KeySplitError(E.threshold(minCustodians, n));
  }

  const custodians = input.custodians.map((c, i) => {
    const name = c.name.trim();
    if (!name) throw new KeySplitError(E.custodianNoName(i + 1));
    try {
      const pk = parsePublicKey(c.publicKeyText);
      return { name, pk, kid: keyId(pk) };
    } catch (e) {
      throw new KeySplitError(E.custodianKey(name, (e as Error).message));
    }
  });
  if (new Set(custodians.map((c) => c.kid)).size !== n) throw new KeySplitError(E.sameKey);
  if (new Set(custodians.map((c) => c.name.toLowerCase())).size !== n) throw new KeySplitError(E.sameName);

  const splitId = bytesToHex(randomBytes(16));
  const meta = { version: FORMAT_VERSION, splitId, label, threshold: input.threshold, total: n };
  const header = splitHeader(meta);

  const dataKey = randomBytes(DATA_KEY_BYTES);
  const payloadNonce = randomBytes(NONCE_BYTES);
  const padded = pad(secretBytes);
  const payload = gcm(dataKey, payloadNonce, header).encrypt(padded);
  padded.fill(0);
  const pieces = await split(dataKey, n, input.threshold);
  dataKey.fill(0);

  const createdAt = new Date().toISOString();
  return custodians.map((c, i) => {
    const index = i + 1;
    const { cipherText, sharedSecret } = XWing.encapsulate(c.pk);
    const key = wrapKey(sharedSecret, splitId, index);
    const nonce = randomBytes(NONCE_BYTES);
    const encPiece = gcm(key, nonce, shareAad(header, index, c.kid)).encrypt(pieces[i]);
    key.fill(0);
    sharedSecret.fill(0);
    pieces[i].fill(0);
    return {
      type: FILE_TYPES.share,
      ...meta,
      index,
      custodian: { name: c.name, keyId: c.kid },
      algorithms: ALGORITHMS,
      kemCipherText: toBase64(cipherText),
      share: { nonce: toBase64(nonce), cipherText: toBase64(encPiece) },
      payload: { nonce: toBase64(payloadNonce), cipherText: toBase64(payload) },
      createdAt,
    };
  });
}

/* ---------- reading files ---------- */

function parseJson(text: string, what: string): Record<string, unknown> {
  try {
    const v = JSON.parse(text);
    if (v && typeof v === "object") return v;
  } catch {
    /* handled below */
  }
  throw new KeySplitError(E.notJson(what));
}

export function parseShareFile(text: string): ShareFile {
  const v = parseJson(text, "share file");
  if (v.type !== FILE_TYPES.share) throw new KeySplitError(v.type === FILE_TYPES.custodianKey ? E.keyNotShare : E.notShare);
  if (!READABLE_VERSIONS.includes(v.version as number)) {
    throw new KeySplitError(E.version(String(v.version), READABLE_VERSIONS.join(", ")));
  }
  return v as unknown as ShareFile;
}

export function parseKeyFile(text: string): CustodianKeyFile {
  const v = parseJson(text, "private key file");
  if (v.type !== FILE_TYPES.custodianKey) throw new KeySplitError(v.type === FILE_TYPES.share ? E.shareNotKey : E.notKey);
  const file = v as unknown as CustodianKeyFile;
  const sk = fromBase64(file.secretKey, "private key");
  if (sk.length !== XWing.lengths.secretKey) throw new KeySplitError(E.keyDamaged);
  // The stored public key must match the private key.
  if (keyId(XWing.getPublicKey(sk)) !== file.keyId) throw new KeySplitError(E.keyMismatch);
  return file;
}

/* ---------- opening one piece ---------- */

/** Decrypts one custodian's piece of the data key. Throws if the key or file is wrong. */
function openPiece(share: ShareFile, key: CustodianKeyFile): Uint8Array {
  if (key.keyId !== share.custodian.keyId) throw new KeySplitError(E.keyNotForShare(share.custodian.name));
  try {
    const sk = fromBase64(key.secretKey, "private key");
    const sharedSecret = XWing.decapsulate(fromBase64(share.kemCipherText, "share"), sk);
    const wk = wrapKey(sharedSecret, share.splitId, share.index);
    const piece = gcm(wk, fromBase64(share.share.nonce, "share"), shareAad(splitHeader(share), share.index, share.custodian.keyId))
      .decrypt(fromBase64(share.share.cipherText, "share"));
    wk.fill(0);
    sharedSecret.fill(0);
    sk.fill(0);
    return piece;
  } catch {
    throw new KeySplitError(E.pieceFailed(share.custodian.name));
  }
}

export interface ShareCheck {
  label: string;
  index: number;
  total: number;
  threshold: number;
  name: string;
}

/**
 * Confirms a custodian's own piece opens with their private key. The piece is
 * wiped straight away; one piece reveals nothing about the secret.
 */
export function checkShare(share: ShareFile, key: CustodianKeyFile): ShareCheck {
  openPiece(share, key).fill(0);
  return { label: share.label, index: share.index, total: share.total, threshold: share.threshold, name: share.custodian.name };
}

/* ---------- recover ---------- */

export interface Slot {
  index: number;
  /** Known only once that custodian's share file is loaded. */
  name: string | null;
  hasShare: boolean;
  hasKey: boolean;
}

export interface Checklist {
  ready: boolean;
  label: string;
  needed: number;
  total: number;
  usable: number;
  slots: Slot[];
  /** Set when the loaded files cannot be used together. */
  problem: string | null;
}

/** What is loaded, per custodian slot, without decrypting anything. */
export function recoveryChecklist(shares: ShareFile[], keys: CustodianKeyFile[]): Checklist {
  if (shares.length === 0) {
    return { ready: false, label: "", needed: 0, total: 0, usable: 0, slots: [], problem: E.noShares };
  }
  const first = shares[0];
  if (shares.some((s) => s.splitId !== first.splitId)) {
    return { ready: false, label: first.label, needed: first.threshold, total: first.total, usable: 0, slots: [], problem: E.mixedSplits };
  }
  const keyIds = new Set(keys.map((k) => k.keyId));
  const slots: Slot[] = Array.from({ length: first.total }, (_, i) => {
    const s = shares.find((x) => x.index === i + 1);
    return { index: i + 1, name: s?.custodian.name ?? null, hasShare: !!s, hasKey: !!s && keyIds.has(s.custodian.keyId) };
  });
  const usable = slots.filter((s) => s.hasShare && s.hasKey).length;
  return {
    ready: usable >= first.threshold,
    label: first.label,
    needed: first.threshold,
    total: first.total,
    usable,
    slots,
    problem: null,
  };
}

export async function recoverSecret(shares: ShareFile[], keys: CustodianKeyFile[]): Promise<string> {
  const list = recoveryChecklist(shares, keys);
  if (list.problem) throw new KeySplitError(list.problem);
  if (!list.ready) throw new KeySplitError(TEXT.notReadyText(list.usable, list.needed));

  const first = shares[0];
  const byKeyId = new Map(keys.map((k) => [k.keyId, k]));
  const pieces: Uint8Array[] = [];
  const seen = new Set<number>();
  for (const s of shares) {
    const key = byKeyId.get(s.custodian.keyId);
    if (!key || seen.has(s.index)) continue;
    pieces.push(openPiece(s, key));
    seen.add(s.index);
    if (pieces.length === first.threshold) break;
  }

  const dataKey = await combine(pieces);
  pieces.forEach((p) => p.fill(0));
  try {
    const opened = gcm(dataKey, fromBase64(first.payload.nonce, "share"), splitHeader(first)).decrypt(
      fromBase64(first.payload.cipherText, "share"),
    );
    // Version 1 files were not padded.
    const secret = first.version >= 2 ? unpad(opened) : opened;
    return new TextDecoder().decode(secret);
  } catch {
    throw new KeySplitError(E.notRebuilt);
  } finally {
    dataKey.fill(0);
  }
}