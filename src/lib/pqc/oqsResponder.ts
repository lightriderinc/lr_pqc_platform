// The built-in responder for the Interop Challenge: liboqs (Open Quantum Safe),
// compiled to WebAssembly, running in the browser.
//
// It reads only the published challenge JSON, exactly as an outside client
// would, and never touches the challenger's internal state. So a pass means an
// independent implementation produced the answer.
//
// liboqs-js loads its WebAssembly through a dynamic import the site's bundler
// cannot follow, so the files are served from public/oqs and loaded with the
// browser's own module loader. The setup below mirrors the library's own
// create functions; the library's classes then do the cryptography.

import { RESPONDER, TEXT, type DsaSet, type KemSet } from "./interopConfig";

/** Error with a message that is safe to show to the user. */
export class ResponderError extends Error {}

interface OqsKem {
  generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array };
  encapsulate(publicKey: Uint8Array): { ciphertext: Uint8Array; sharedSecret: Uint8Array };
  decapsulate(ciphertext: Uint8Array, secretKey: Uint8Array): Uint8Array;
}

interface OqsSig {
  generateKeyPair(): { publicKey: Uint8Array; secretKey: Uint8Array };
  sign(message: Uint8Array, secretKey: Uint8Array): Uint8Array;
  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean;
}

interface WasmModule {
  _OQS_init(): void;
  _OQS_KEM_new(namePtr: number): number;
  _OQS_SIG_new(namePtr: number): number;
  _malloc(size: number): number;
  _free(ptr: number): void;
  lengthBytesUTF8(s: string): number;
  stringToUTF8(s: string, ptr: number, max: number): void;
}

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));

/** Loaded instances, kept for the page's lifetime so each file loads once. */
const instances = new Map<string, Promise<unknown>>();

async function load(alg: KemSet | DsaSet, kind: "kem" | "sig"): Promise<unknown> {
  const url = `${RESPONDER.base}/${RESPONDER.files[alg]}`;
  // Loaded by the browser, not the bundler.
  const mod = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url);
  const wasm = (await mod.default()) as WasmModule;
  wasm._OQS_init();
  const len = wasm.lengthBytesUTF8(alg);
  const namePtr = wasm._malloc(len + 1);
  wasm.stringToUTF8(alg, namePtr, len + 1);
  const ptr = kind === "kem" ? wasm._OQS_KEM_new(namePtr) : wasm._OQS_SIG_new(namePtr);
  wasm._free(namePtr);
  if (!ptr) throw new ResponderError(TEXT.errors.responderFailed);
  const lib = (await import("@oqs/liboqs-js")) as unknown as Record<string, new (w: WasmModule, p: number) => unknown>;
  return new lib[RESPONDER.classes[alg]](wasm, ptr);
}

function instance<T>(alg: KemSet | DsaSet, kind: "kem" | "sig"): Promise<T> {
  if (!instances.has(alg)) {
    const p = load(alg, kind);
    p.catch(() => instances.delete(alg)); // allow a retry after a failure
    instances.set(alg, p);
  }
  return instances.get(alg) as Promise<T>;
}

/** Version of liboqs-js the files came from, from the manifest written by the copy script. */
export async function responderVersion(): Promise<string> {
  const res = await fetch(RESPONDER.manifest);
  if (!res.ok) throw new ResponderError(TEXT.errors.responderFailed);
  return String((await res.json()).version);
}

function read(challengeText: string): Record<string, string> {
  return JSON.parse(challengeText);
}

const out = (o: object) => JSON.stringify(o, null, 2);

/* ---------- answers ---------- */

export async function answerEncaps(challengeText: string): Promise<string> {
  const ch = read(challengeText);
  const kem = await instance<OqsKem>(ch.alg as KemSet, "kem");
  const { ciphertext, sharedSecret } = kem.encapsulate(unhex(ch.publicKey));
  return out({ cipherText: hex(ciphertext), sharedSecret: hex(sharedSecret) });
}

/** Answers the key request. The private key stays with the caller, as a client keeps its own key. */
export async function answerKeyRequest(challengeText: string): Promise<{ response: string; secretKey: Uint8Array }> {
  const ch = read(challengeText);
  const kem = await instance<OqsKem>(ch.alg as KemSet, "kem");
  const { publicKey, secretKey } = kem.generateKeyPair();
  return { response: out({ publicKey: hex(publicKey) }), secretKey };
}

export async function answerDecaps(challengeText: string, secretKey: Uint8Array): Promise<string> {
  const ch = read(challengeText);
  const kem = await instance<OqsKem>(ch.alg as KemSet, "kem");
  return out({ sharedSecret: hex(kem.decapsulate(unhex(ch.cipherText), secretKey)) });
}

export async function answerSign(challengeText: string): Promise<string> {
  const ch = read(challengeText);
  const sig = await instance<OqsSig>(ch.alg as DsaSet, "sig");
  const { publicKey, secretKey } = sig.generateKeyPair();
  const signature = sig.sign(unhex(ch.message), secretKey);
  secretKey.fill(0);
  return out({ publicKey: hex(publicKey), signature: hex(signature) });
}

export async function answerVerify(challengeText: string): Promise<string> {
  const ch = read(challengeText) as unknown as { alg: DsaSet; publicKey: string; message: string; signatures: string[] };
  const sig = await instance<OqsSig>(ch.alg, "sig");
  const results = ch.signatures.map((s) => sig.verify(unhex(ch.message), unhex(s), unhex(ch.publicKey)));
  return out({ validIndex: results.indexOf(true) });
}