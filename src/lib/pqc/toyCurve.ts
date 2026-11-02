// A small elliptic curve for the Harvest Now, Decrypt Later demo.
//
// It uses the same kind of mathematics as X25519: points on a curve over a
// prime field, where security rests on the discrete logarithm problem. The
// only difference is size. At the small test size a normal computer can find
// a private key from a public key. At X25519's real size, only a quantum
// computer running Shor's algorithm could. Nothing here protects real data.
//
// No curve values are typed in by hand. The prime is calculated from a size
// in bits, and the base point is found by search.

import { bytesToHex, randomBytes } from "@noble/hashes/utils.js";

export type Point = { x: bigint; y: bigint } | null; // null = point at infinity

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);
const THREE = BigInt(3);
const FOUR = BigInt(4);

const mod = (a: bigint, p: bigint) => ((a % p) + p) % p;

function modPow(base: bigint, exp: bigint, m: bigint): bigint {
  let result = ONE;
  let b = mod(base, m);
  let e = exp;
  while (e > ZERO) {
    if (e & ONE) result = mod(result * b, m);
    b = mod(b * b, m);
    e >>= ONE;
  }
  return result;
}

function inverse(a: bigint, p: bigint): bigint {
  let [oldR, r] = [mod(a, p), p];
  let [oldS, s] = [ONE, ZERO];
  while (r !== ZERO) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return mod(oldS, p);
}

/** Miller-Rabin with fixed bases. Deterministic for numbers below 3.3 * 10^24. */
const WITNESSES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41].map(BigInt);

export function isPrime(n: bigint): boolean {
  if (n < TWO) return false;
  for (const w of WITNESSES) {
    if (n === w) return true;
    if (n % w === ZERO) return false;
  }
  let d = n - ONE;
  let r = 0;
  while (d % TWO === ZERO) {
    d /= TWO;
    r++;
  }
  for (const w of WITNESSES) {
    let x = modPow(w, d, n);
    if (x === ONE || x === n - ONE) continue;
    let composite = true;
    for (let i = 0; i < r - 1; i++) {
      x = mod(x * x, n);
      if (x === n - ONE) {
        composite = false;
        break;
      }
    }
    if (composite) return false;
  }
  return true;
}

/** Smallest prime p >= 2^bits with p mod 4 = 3 (needed for the square-root formula). */
export function primeForBits(bits: number): bigint {
  let p = TWO ** BigInt(bits);
  while (!(mod(p, FOUR) === THREE && isPrime(p))) p += ONE;
  return p;
}

export interface ToyCurve {
  bits: number;
  p: bigint;
  a: bigint;
  b: bigint;
  G: NonNullable<Point>;
  /** Hasse upper bound on the number of points. Every private key is below it. */
  bound: bigint;
  /** Bytes needed to write one coordinate. */
  coordBytes: number;
}

export function add(c: ToyCurve, P: Point, Q: Point): Point {
  if (P === null) return Q;
  if (Q === null) return P;
  if (P.x === Q.x && mod(P.y + Q.y, c.p) === ZERO) return null;
  const slope =
    P.x === Q.x && P.y === Q.y
      ? mod((THREE * P.x * P.x + c.a) * inverse(TWO * P.y, c.p), c.p)
      : mod((Q.y - P.y) * inverse(mod(Q.x - P.x, c.p), c.p), c.p);
  const x = mod(slope * slope - P.x - Q.x, c.p);
  return { x, y: mod(slope * (P.x - x) - P.y, c.p) };
}

export function negate(c: ToyCurve, P: Point): Point {
  return P === null ? null : { x: P.x, y: mod(-P.y, c.p) };
}

/** k·P by double-and-add. */
export function multiply(c: ToyCurve, k: bigint, P: Point): Point {
  let result: Point = null;
  let addend = P;
  let n = mod(k, c.bound);
  while (n > ZERO) {
    if (n & ONE) result = add(c, result, addend);
    addend = add(c, addend, addend);
    n >>= ONE;
  }
  return result;
}

export function samePoint(P: Point, Q: Point): boolean {
  if (P === null || Q === null) return P === Q;
  return P.x === Q.x && P.y === Q.y;
}

/**
 * Builds y^2 = x^3 + ax + b over the prime for the given size, and finds a
 * base point by trying x = 2, 3, 4, ... until x^3 + ax + b has a square root.
 */
export function makeToyCurve(bits: number, a: number, b: number): ToyCurve {
  if (!Number.isInteger(bits) || bits < 16 || bits > 48) {
    throw new Error("Test curve size must be between 16 and 48 bits.");
  }
  const p = primeForBits(bits);
  const A = BigInt(a);
  const B = BigInt(b);
  if (mod(FOUR * A * A * A + BigInt(27) * B * B, p) === ZERO) {
    throw new Error("These curve settings give a singular curve. Change a or b.");
  }
  let G: Point = null;
  for (let x = TWO; G === null; x++) {
    const rhs = mod(x * x * x + A * x + B, p);
    const y = modPow(rhs, (p + ONE) / FOUR, p);
    if (mod(y * y, p) === rhs && y !== ZERO) G = { x, y };
  }
  const bound = p + ONE + TWO * BigInt(Math.ceil(Math.sqrt(Number(p))));
  return { bits, p, a: A, b: B, G, bound, coordBytes: Math.ceil(bits / 8) };
}

/** A random private key in 1 .. bound-1 whose public key is not infinity. */
export function randomPrivateKey(c: ToyCurve): bigint {
  for (;;) {
    const r = BigInt("0x" + bytesToHex(randomBytes(c.coordBytes + 8)));
    const k = mod(r, c.bound - ONE) + ONE;
    if (multiply(c, k, c.G) !== null) return k;
  }
}

/** Public key as bytes: x then y, each padded to the coordinate size. */
export function pointBytes(c: ToyCurve, P: Point): Uint8Array {
  if (P === null) throw new Error("Cannot encode the point at infinity.");
  const hex = (v: bigint) => v.toString(16).padStart(c.coordBytes * 2, "0");
  const all = hex(P.x) + hex(P.y);
  return Uint8Array.from(all.match(/../g)!.map((h) => parseInt(h, 16)));
}

/** The shared value of an elliptic curve key exchange: x of (myPrivate · theirPublic). */
export function sharedX(c: ToyCurve, myPrivate: bigint, theirPublic: Point): Uint8Array {
  const S = multiply(c, myPrivate, theirPublic);
  if (S === null) throw new Error("Key exchange produced the point at infinity.");
  const hex = S.x.toString(16).padStart(c.coordBytes * 2, "0");
  return Uint8Array.from(hex.match(/../g)!.map((h) => parseInt(h, 16)));
}

export interface SearchProgress {
  steps: number;
  maxSteps: number;
}

export class SearchCancelled extends Error {}

/**
 * Finds a private key d with d·G = Q using baby-step giant-step, looking only
 * at the public key Q. It does about 2·sqrt(bound) curve additions. Work runs
 * in chunks with a pause between them, so the page stays responsive and the
 * step counter shows the real number of steps done.
 */
export async function findPrivateKey(
  c: ToyCurve,
  Q: Point,
  chunkSteps: number,
  onProgress: (p: SearchProgress) => void,
  isCancelled: () => boolean,
): Promise<{ key: bigint; steps: number } | null> {
  const m = BigInt(Math.ceil(Math.sqrt(Number(c.bound))));
  const maxSteps = Number(m) * 2 + 2;
  const pause = () => new Promise<void>((r) => setTimeout(r, 0));
  let steps = 0;

  // Baby steps: remember x of j·G for j = 1 .. m-1. j·G and -j·G share x, so
  // both candidates are checked on a hit.
  const table = new Map<number, bigint>();
  let P: Point = null;
  for (let j = ZERO; j < m; j++) {
    if (P !== null) table.set(Number(P.x), j);
    P = add(c, P, c.G);
    if (++steps % chunkSteps === 0) {
      if (isCancelled()) throw new SearchCancelled();
      onProgress({ steps, maxSteps });
      await pause();
    }
  }

  // Giant steps: Q - i·m·G for i = 0, 1, 2, ...
  const minusMG = negate(c, multiply(c, m, c.G));
  let gamma = Q;
  for (let i = ZERO; i <= m + ONE; i++) {
    const candidates: bigint[] = [];
    if (gamma === null) candidates.push(i * m);
    else {
      const j = table.get(Number(gamma.x));
      if (j !== undefined) candidates.push(i * m + j, i * m - j);
    }
    for (const d of candidates) {
      const key = mod(d, c.bound);
      if (key !== ZERO && samePoint(multiply(c, key, c.G), Q)) {
        onProgress({ steps, maxSteps });
        return { key, steps };
      }
    }
    gamma = add(c, gamma, minusMG);
    if (++steps % chunkSteps === 0) {
      if (isCancelled()) throw new SearchCancelled();
      onProgress({ steps, maxSteps });
      await pause();
    }
  }
  return null;
}