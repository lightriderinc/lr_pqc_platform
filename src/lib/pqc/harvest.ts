// Harvest Now, Decrypt Later demo: logic only. Settings live in harvestConfig.ts.
//
// Two real key exchanges run side by side:
//   1. Elliptic curve key exchange on a small test curve (X25519's mathematics).
//   2. ML-KEM-768 (FIPS 203).
// Each one encrypts the user's message with its shared secret.
//
// Each attack function receives only a Recording: the public values and the
// encrypted message, exactly what an eavesdropper sees. A Recording holds no
// private key and no shared secret, so the attack cannot use anything an
// eavesdropper would not have. Everything runs in the browser.

import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, randomBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";
import { FINGERPRINT_BYTES, KDF_LABEL, LABELS, MESSAGE, TEST_CURVE, TEXT } from "./harvestConfig";
import {
  findPrivateKey,
  makeToyCurve,
  multiply,
  pointBytes,
  randomPrivateKey,
  samePoint,
  sharedX,
  type Point,
  type SearchProgress,
  type ToyCurve,
} from "./toyCurve";

/** Error with a message that is safe to show to the user. */
export class HarvestError extends Error {}

export interface Step {
  label: string;
  ms: number;
  /** Size of what this step sends over the network, when it sends something. */
  sentBytes?: number;
}

export interface WireItem {
  label: string;
  bytes: Uint8Array;
}

/* ---------- helpers ---------- */

const NONCE_BYTES = 12;

function messageKey(sharedSecret: Uint8Array): Uint8Array {
  return hkdf(sha256, sharedSecret, undefined, utf8ToBytes(KDF_LABEL), 32);
}

function fingerprint(sharedSecret: Uint8Array): string {
  return bytesToHex(sha256(sharedSecret).subarray(0, FINGERPRINT_BYTES)).match(/.{4}/g)!.join(" ");
}

function timed<T>(fn: () => T): { value: T; ms: number } {
  const t = performance.now();
  const value = fn();
  return { value, ms: performance.now() - t };
}

function encrypt(sharedSecret: Uint8Array, message: string) {
  const nonce = randomBytes(NONCE_BYTES);
  const ciphertext = gcm(messageKey(sharedSecret), nonce).encrypt(utf8ToBytes(message));
  return { nonce, ciphertext };
}

/** Returns the message, or null when the key is wrong (AES-GCM rejects it). */
function tryDecrypt(sharedSecret: Uint8Array, nonce: Uint8Array, ciphertext: Uint8Array): string | null {
  try {
    return new TextDecoder().decode(gcm(messageKey(sharedSecret), nonce).decrypt(ciphertext));
  } catch {
    return null;
  }
}

export function checkMessage(message: string): string {
  const m = message.trim();
  if (!m) throw new HarvestError(TEXT.emptyMessage);
  if (m.length > MESSAGE.maxChars) throw new HarvestError(TEXT.tooLong(MESSAGE.maxChars));
  return m;
}

/* ---------- recordings: what an eavesdropper has ---------- */

export interface EcRecording {
  kind: "ec";
  curve: ToyCurve;
  alicePublic: Point;
  bobPublic: Point;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

export interface KemRecording {
  kind: "kem";
  alicePublicKey: Uint8Array;
  kemCiphertext: Uint8Array;
  nonce: Uint8Array;
  ciphertext: Uint8Array;
}

/* ---------- the key exchanges ---------- */

export interface ExchangeResult<R> {
  steps: Step[];
  wire: WireItem[];
  aliceFingerprint: string;
  bobFingerprint: string;
  recording: R;
}

/** Elliptic curve key exchange on the test curve. Alice sends the message. */
export function runEcExchange(message: string): ExchangeResult<EcRecording> {
  const curve = makeToyCurve(TEST_CURVE.bits, TEST_CURVE.a, TEST_CURVE.b);

  const alice = timed(() => {
    const priv = randomPrivateKey(curve);
    return { priv, pub: multiply(curve, priv, curve.G) };
  });
  const bob = timed(() => {
    const priv = randomPrivateKey(curve);
    return { priv, pub: multiply(curve, priv, curve.G) };
  });
  const aliceShared = timed(() => sharedX(curve, alice.value.priv, bob.value.pub));
  const bobShared = timed(() => sharedX(curve, bob.value.priv, alice.value.pub));
  const { nonce, ciphertext } = encrypt(aliceShared.value, message);

  const alicePubBytes = pointBytes(curve, alice.value.pub);
  const bobPubBytes = pointBytes(curve, bob.value.pub);

  return {
    steps: [
      { label: LABELS.ec.alice, ms: alice.ms, sentBytes: alicePubBytes.length },
      { label: LABELS.ec.bob, ms: bob.ms, sentBytes: bobPubBytes.length },
      { label: LABELS.ec.aliceShared, ms: aliceShared.ms },
      { label: LABELS.ec.bobShared, ms: bobShared.ms },
    ],
    wire: [
      { label: LABELS.wire.alicePublic, bytes: alicePubBytes },
      { label: LABELS.wire.bobPublic, bytes: bobPubBytes },
      { label: LABELS.wire.message, bytes: ciphertext },
    ],
    aliceFingerprint: fingerprint(aliceShared.value),
    bobFingerprint: fingerprint(bobShared.value),
    recording: { kind: "ec", curve, alicePublic: alice.value.pub, bobPublic: bob.value.pub, nonce, ciphertext },
  };
}

/** ML-KEM-768 key exchange. Alice publishes a key, Bob encapsulates, Alice decapsulates. */
export function runKemExchange(message: string): ExchangeResult<KemRecording> {
  const alice = timed(() => ml_kem768.keygen());
  const bob = timed(() => ml_kem768.encapsulate(alice.value.publicKey));
  const aliceShared = timed(() => ml_kem768.decapsulate(bob.value.cipherText, alice.value.secretKey));
  const { nonce, ciphertext } = encrypt(aliceShared.value, message);

  return {
    steps: [
      { label: LABELS.kem.alice, ms: alice.ms, sentBytes: alice.value.publicKey.length },
      { label: LABELS.kem.bob, ms: bob.ms, sentBytes: bob.value.cipherText.length },
      { label: LABELS.kem.aliceShared, ms: aliceShared.ms },
    ],
    wire: [
      { label: LABELS.wire.alicePublic, bytes: alice.value.publicKey },
      { label: LABELS.wire.bobCiphertext, bytes: bob.value.cipherText },
      { label: LABELS.wire.message, bytes: ciphertext },
    ],
    aliceFingerprint: fingerprint(aliceShared.value),
    bobFingerprint: fingerprint(bob.value.sharedSecret),
    recording: {
      kind: "kem",
      alicePublicKey: alice.value.publicKey,
      kemCiphertext: bob.value.cipherText,
      nonce,
      ciphertext,
    },
  };
}

/* ---------- the attacks ---------- */

export interface EcAttackResult {
  /** Null when the search found no key (it always should). */
  recoveredKey: string | null;
  steps: number;
  ms: number;
  /** The message decrypted with the recovered key, or null if decryption failed. */
  decrypted: string | null;
}

/**
 * Finds Alice's private key from her public key alone, then uses it with
 * Bob's public key to rebuild the shared secret and decrypt the message.
 * Uses nothing but the recording.
 */
export async function attackEc(
  rec: EcRecording,
  chunkSteps: number,
  onProgress: (p: SearchProgress) => void,
  isCancelled: () => boolean,
): Promise<EcAttackResult> {
  const t = performance.now();
  const found = await findPrivateKey(rec.curve, rec.alicePublic, chunkSteps, onProgress, isCancelled);
  if (!found || !samePoint(multiply(rec.curve, found.key, rec.curve.G), rec.alicePublic)) {
    return { recoveredKey: null, steps: found?.steps ?? 0, ms: performance.now() - t, decrypted: null };
  }
  const shared = sharedX(rec.curve, found.key, rec.bobPublic);
  return {
    recoveredKey: found.key.toString(),
    steps: found.steps,
    ms: performance.now() - t,
    decrypted: tryDecrypt(shared, rec.nonce, rec.ciphertext),
  };
}

export interface KemAttackResult {
  /** The message, if the attempt opened it. With ML-KEM it does not. */
  decrypted: string | null;
  ms: number;
}

/**
 * The eavesdropper's real options against ML-KEM: no algorithm is known that
 * finds the private key from the public key. The only thing left is to try
 * a private key the attacker does not have. Here the attacker makes a fresh
 * key pair and decapsulates the recorded ciphertext with it. ML-KEM returns
 * an unrelated value for a wrong key, so decryption fails.
 */
export function attackKem(rec: KemRecording): KemAttackResult {
  const t = performance.now();
  const guess = ml_kem768.keygen();
  const wrongSecret = ml_kem768.decapsulate(rec.kemCiphertext, guess.secretKey);
  return { decrypted: tryDecrypt(wrongSecret, rec.nonce, rec.ciphertext), ms: performance.now() - t };
}