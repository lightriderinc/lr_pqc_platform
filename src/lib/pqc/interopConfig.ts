// Configuration for the Interop Challenge.
//
// Every parameter set, size, format name, and piece of text lives here.
// interop.ts holds logic only. Every challenge is generated fresh, at random,
// when it is shown. Nothing is stored or reused.

export const KEM_SETS = ["ML-KEM-512", "ML-KEM-768", "ML-KEM-1024"] as const;
export const DSA_SETS = ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"] as const;
export type KemSet = (typeof KEM_SETS)[number];
export type DsaSet = (typeof DSA_SETS)[number];

export const DEFAULT_KEM: KemSet = "ML-KEM-768";
export const DEFAULT_DSA: DsaSet = "ML-DSA-65";

/** Random bytes in each message to sign. */
export const MESSAGE_BYTES = 32;
/**
 * Bytes in each ML-DSA context string. Empty is the standard's default and
 * the most common setting; some libraries, including liboqs-js, do not let
 * callers set a context, so a non-empty one would make them fail unfairly.
 */
export const CONTEXT_BYTES = 0;

/** Written into every challenge, so scripts can tell what they are reading. */
export const CHALLENGE_FORMAT = "lightrider-interop/1";

/**
 * The built-in responder: liboqs from the Open Quantum Safe project, compiled
 * to WebAssembly. It shares no code with the challenger (@noble/post-quantum),
 * so a pass means two independent implementations agree. Its files are copied
 * into public/oqs by scripts/copy-liboqs.mjs.
 */
export const RESPONDER = {
  base: "/oqs",
  manifest: "/oqs/manifest.json",
  files: {
    "ML-KEM-512": "ml-kem-512.min.js",
    "ML-KEM-768": "ml-kem-768.min.js",
    "ML-KEM-1024": "ml-kem-1024.min.js",
    "ML-DSA-44": "ml-dsa-44.min.js",
    "ML-DSA-65": "ml-dsa-65.min.js",
    "ML-DSA-87": "ml-dsa-87.min.js",
  } as Record<KemSet | DsaSet, string>,
  /** Class names exported by @oqs/liboqs-js for each parameter set. */
  classes: {
    "ML-KEM-512": "MLKEM512",
    "ML-KEM-768": "MLKEM768",
    "ML-KEM-1024": "MLKEM1024",
    "ML-DSA-44": "MLDSA44",
    "ML-DSA-65": "MLDSA65",
    "ML-DSA-87": "MLDSA87",
  } as Record<KemSet | DsaSet, string>,
};

/** The "test" names a responding script switches on. */
export const TESTS = {
  encaps: "ml-kem-encaps",
  keygen: "ml-kem-keygen",
  decaps: "ml-kem-decaps",
  sign: "ml-dsa-sign",
  verify: "ml-dsa-verify",
} as const;

export const TEXT = {
  title: "PQC Compatibility Check",
  intro: "Test any ML-KEM or ML-DSA implementation against a fresh random challenge.",
  families: { kem: "ML-KEM", dsa: "ML-DSA" },
  parameterSet: "Parameter set",

  encaps: {
    title: "1. You encapsulate",
    how: "Encapsulate to this public key with your code. Paste back the ciphertext and shared secret.",
  },
  decaps: {
    title: "2. You decapsulate",
    how: "Answer the key request with a new public key. Then decapsulate the ciphertext you get and paste back the shared secret.",
    keyRequest: "Key request",
    yourKey: "Your public key",
    makeCiphertext: "Create ciphertext",
  },
  sign: {
    title: "3. You sign",
    how: "Sign this message with this context using your code. Paste back your public key and the signature.",
  },
  verify: {
    title: "4. You verify",
    how: "One of these two signatures is valid for this message. Verify both with your code and paste back the index of the valid one.",
  },

  challenge: "Challenge",
  response: "Your response",
  responsePlaceholder: "Paste the JSON your code printed",
  check: "Check",
  newChallenge: "New challenge",
  pass: "Pass",
  fail: "Fail",
  answerWith: "Answer with liboqs",
  answering: "Running liboqs",
  answeredBy: (version: string) =>
    `Answered by liboqs ${version} (Open Quantum Safe), running in this browser. It shares no code with the challenger.`,
  footer:
    "You can also paste an answer from your own implementation: your library, a vendor's product, or Lightrider's Veloce SDK. Each challenge is new random data, so an answer cannot be reused.",

  results: {
    encapsOk: (alg: string) => `Your ${alg} encapsulation is correct: the shared secrets match.`,
    decapsOk: (alg: string) => `Your ${alg} decapsulation is correct: the shared secrets match.`,
    signOk: (alg: string) => `Your ${alg} signature verifies with your public key, this message, and this context.`,
    verifyOk: (alg: string) => `Your ${alg} verification picked the valid signature.`,
    secretMismatch: "The shared secrets do not match. Your implementation and the standard disagree.",
    signatureInvalid: "The signature does not verify for this message and context with your public key.",
    wrongPick: "That is the signature for a different message. Your verification accepted the wrong one, or rejected the right one.",
  },

  errors: {
    notJson: "The response is not valid JSON.",
    missing: (field: string) => `The response has no "${field}" field.`,
    notHex: (field: string) => `"${field}" is not hexadecimal.`,
    wrongLength: (field: string, want: number, got: number) => `"${field}" must be ${want} bytes for this parameter set; got ${got}.`,
    badIndex: 'The response must have "validIndex" set to 0 or 1.',
    noChallenge: "Create a challenge first.",
    responderFailed: "liboqs could not run in this browser.",
    noSavedKey: "Answer the key request with liboqs first.",
    generic: "Something went wrong.",
  },
};