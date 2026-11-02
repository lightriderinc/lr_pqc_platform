// Configuration for the Harvest Now, Decrypt Later demo.
//
// Every setting and every piece of text lives here. harvest.ts and
// toyCurve.ts hold logic only.

/**
 * The test curve: y^2 = x^3 + ax + b over the smallest suitable prime of
 * this many bits. 36 bits makes the attack do several hundred thousand real
 * steps, which takes about a second in a browser.
 */
export const TEST_CURVE = { bits: 36, a: 2, b: 2 };

/** Size of real X25519, for the comparison note. */
export const REAL_X25519_BITS = 255;

/** The attack reports progress and pauses after this many steps. */
export const ATTACK_CHUNK_STEPS = 8192;

export const MESSAGE = {
  placeholder: "Transfer approved. Account 4471-9823.",
  maxChars: 200,
};

/** Bound into every key derivation, so the demo keys are used for nothing else. */
export const KDF_LABEL = "lightrider-harvest-demo-v1";

/** Bytes of SHA-256 shown as a secret's fingerprint. */
export const FINGERPRINT_BYTES = 6;

export const NEXT_STEP = {
  href: "/qsearch",
  label: "Find X25519, ECDH, and RSA in your own code with qSearch",
};

/** Labels for each handshake step and each recorded item. */
export const LABELS = {
  ec: {
    alice: "Alice makes a key pair, sends her public key",
    bob: "Bob makes a key pair, sends his public key",
    aliceShared: "Alice computes the shared secret",
    bobShared: "Bob computes the shared secret",
  },
  kem: {
    alice: "Alice makes a key pair, sends her public key",
    bob: "Bob encapsulates a secret, sends the ciphertext",
    aliceShared: "Alice decapsulates the same secret",
  },
  wire: {
    alicePublic: "Alice's public key",
    bobPublic: "Bob's public key",
    bobCiphertext: "Bob's ciphertext",
    message: "Encrypted message",
  },
};

export const TEXT = {
  intro: "Record a key exchange. Then attack the recording.",
  privacy: "Everything runs in your browser. Nothing is sent anywhere.",
  messageLabel: "Alice's message",
  run: "Run key exchange",
  rerun: "New key exchange",
  attack: "Attack the recording",
  attacking: "Attacking",
  ecTitle: "Elliptic curve",
  ecSubtitle: (bits: number) => `X25519's mathematics, ${bits}-bit test size`,
  kemTitle: "ML-KEM-768",
  kemSubtitle: "FIPS 203, post-quantum",
  recorded: "What the eavesdropper recorded",
  secretsMatch: "Both sides hold the same secret",
  broken: "Broken",
  safe: "Safe",
  ecBrokenDetail: (steps: string, seconds: string) =>
    `Alice's private key found in ${steps} steps (${seconds} s), using only her public key.`,
  decryptedLabel: "Decrypted with the recovered key",
  matchesMessage: "Matches Alice's message",
  sizeNote: (bits: number, realBits: number) =>
    `At this ${bits}-bit test size a normal computer finds the key. At X25519's real ${realBits}-bit size, only a quantum computer running Shor's algorithm could.`,
  kemSafeDetail: "No known attack, quantum or classical, finds ML-KEM's private key from its public key.",
  kemAttempt: "Opening the recording without Alice's private key",
  kemRejected: "Rejected",
  emptyMessage: "Type a message for Alice to send.",
  tooLong: (max: number) => `Keep the message under ${max} characters.`,
  searchFailed: "The search ended without a working key.",
  stepsOf: (done: string, max: string) => `${done} / ${max} steps`,
};