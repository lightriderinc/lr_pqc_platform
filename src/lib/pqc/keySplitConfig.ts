// Configuration for Secret Split.
//
// All limits, format identifiers, algorithm labels, and text live here. The
// logic in keySplit.ts reads them and contains no fixed values or wording.

export const KEYSPLIT_LIMITS = {
  /** Shamir needs at least 2 custodians. */
  minCustodians: 2,
  /** Upper limit for this tool. The Shamir library itself allows 255. */
  maxCustodians: 10,
  /** Size limit of the secret, in bytes after UTF-8 encoding. */
  maxSecretBytes: 64 * 1024,
  /** Largest file the recovery step reads. Share files are a few KB. */
  maxFileBytes: 512 * 1024,
  /** Longest label accepted. */
  maxLabelChars: 120,
};

/**
 * Version written into new files. Version 2 pads the secret before
 * encrypting it, so a share file does not reveal the secret's exact length.
 */
export const FORMAT_VERSION = 2;
/** Versions this tool can still read. Version 1 files have no padding. */
export const READABLE_VERSIONS = [1, 2];

/**
 * The secret is stored as: 4-byte length, the secret, then zero bytes up to a
 * multiple of this size. A share file then shows only this rounded size.
 */
export const PAD_BLOCK_BYTES = 256;
/** Bytes used to record the real length inside the padded block. */
export const LENGTH_PREFIX_BYTES = 4;

export const FILE_TYPES = {
  custodianKey: "lightrider-custodian-key",
  share: "lightrider-key-share",
} as const;

/** Prefix of the copyable public key text, so a pasted value is recognised. */
export const PUBLIC_KEY_PREFIX = "lrpk1:";

export const ALGORITHMS = {
  kem: "X-Wing (X25519 + ML-KEM-768)",
  aead: "AES-256-GCM",
  kdf: "HKDF-SHA256",
  sharing: "Shamir secret sharing over GF(2^8)",
};

/** Context string bound into every key derivation, so keys cannot be reused elsewhere. */
export const HKDF_INFO = "lightrider-keysplit-v1";

/** Length of the random key that is split. AES-256 needs 32 bytes. */
export const DATA_KEY_BYTES = 32;

/** AES-GCM nonce length in bytes. */
export const NONCE_BYTES = 12;

/** Bytes of SHA-256(public key) shown as a fingerprint. */
export const FINGERPRINT_BYTES = 8;

/** Practice mode: real keys and a real split, all held in this browser. */
export const PRACTICE = {
  names: ["Practice Alice", "Practice Bob", "Practice Carol"],
  threshold: 2,
  label: "Practice secret",
};

export const TEXT = {
  title: "Secret Split",
  intro: "Lock a secret so that several people must work together to open it.",
  privacy: "Everything runs in your browser. No secret, key, or file is sent to Lightrider.",
  tabs: {
    keys: "1. Custodian key",
    split: "2. Split",
    check: "3. Check a share",
    recover: "4. Recover",
  },

  keysIntro: "Each custodian makes their own key here, keeps the private key file, and sends the public key to whoever splits the secret.",
  namePlaceholder: "Your name",
  createKey: "Create key",
  fingerprint: "Fingerprint",
  fingerprintHint: "Read this out to the person splitting the secret. It must match what they see.",
  publicKeyTitle: "Public key: share this",
  privateKeyWarning: "Private key: keep this file safe. Anyone who has it can open your piece. If you lose it, your piece cannot be opened.",
  downloadPrivateKey: "Download private key file",

  practiceButton: "Try it with practice custodians",
  practiceBanner: (names: string) =>
    `Practice mode: ${names}. These are real keys and a real split, but all held in this browser. Use real people for a real secret.`,
  labelTitle: "Label",
  labelPlaceholder: "For example: AWS root account password",
  secretTitle: "Secret",
  secretCleared: "The secret is cleared from this page after the split.",
  custodiansTitle: "Custodians",
  custodianName: "Name",
  publicKeyPlaceholder: "Paste their public key (starts with lrpk1:)",
  fingerprintConfirm: (fp: string, name: string) => `Fingerprint ${fp}. Confirm it with ${name}.`,
  theCustodian: "the custodian",
  invalidPublicKey: "This public key is not valid. Copy it again in full.",
  addCustodian: "Add custodian",
  removeCustodian: (n: number) => `Remove custodian ${n}`,
  thresholdTitle: "How many are needed to open it",
  thresholdOption: (k: number, n: number) => `Any ${k} of ${n}`,
  thresholdHint: (block: number) =>
    `Fewer than this cannot open the secret or read any of it. A single share shows only its size, rounded up to ${block} bytes.`,
  splitButton: "Split secret",
  splitting: "Splitting",
  splitDone: (k: number, n: number, label: string) =>
    `Done. Any ${k} of ${n} custodians can open "${label}". Send each custodian only their own file.`,
  downloadShare: "Download share",
  practiceShares: "Practice shares are ready in the Check and Recover tabs.",

  checkIntro: "Load your share file and your private key file. This confirms your piece opens. It does not reveal the secret.",
  checkOk: (label: string, index: number, total: number, k: number) =>
    `Your piece opens. It belongs to "${label}", you are custodian ${index} of ${total}, and ${k} are needed to open it.`,

  dropFiles: "Drop share files and private key files, or click to choose",
  dropHint: "You can add several files at once.",
  usePractice: "Load the practice files",
  recoverIntro: "Load share files and the matching private key files from enough custodians. Everyone's files are read in this one browser, and whoever runs this sees the secret.",
  checklistTitle: (label: string, k: number, n: number) => `"${label}": needs ${k} of ${n}`,
  slotUnknown: (index: number) => `Custodian ${index}`,
  slotShare: "share",
  slotKey: "key",
  slotReady: "ready",
  slotMissing: "not loaded",
  readyText: (usable: number, k: number) => `Ready: ${usable} pieces can be opened and ${k} are needed.`,
  notReadyText: (usable: number, k: number) => `${usable} of ${k} needed pieces can be opened. Add more share files and private key files.`,
  clear: "Clear",
  recoverButton: "Recover secret",
  recovering: "Recovering",
  recoveredTitle: "Recovered secret",
  recoveredHint: "Close this window when you are done. The secret is not stored anywhere.",

  errors: {
    noName: "Enter the custodian's name.",
    noLabel: "Enter a label so custodians know what the share is for.",
    labelTooLong: (max: number) => `Keep the label under ${max} characters.`,
    noSecret: "Enter the secret to protect.",
    secretTooLarge: (kb: number) => `The secret is too large. The limit is ${kb} KB.`,
    custodianCount: (min: number, max: number) => `Add between ${min} and ${max} custodians.`,
    threshold: (min: number, n: number) => `The number needed must be between ${min} and ${n}.`,
    custodianNoName: (i: number) => `Custodian ${i} has no name.`,
    custodianKey: (name: string, reason: string) => `${name}: ${reason}`,
    sameKey: "Two custodians have the same public key. Each custodian needs their own key.",
    sameName: "Two custodians have the same name. Use a different name for each.",
    noPublicKey: "Paste the custodian's public key.",
    badEncoding: (what: string) => `The ${what} is not valid. Copy it again in full.`,
    wrongKeyLength: "The public key has the wrong length. Copy it again in full.",
    notJson: (what: string) => `This is not a valid ${what}.`,
    keyNotShare: "This is a private key file, not a share file.",
    shareNotKey: "This is a share file, not a private key file.",
    notShare: "This is not a share file.",
    notKey: "This is not a private key file.",
    version: (v: string, readable: string) => `This share file uses format version ${v}. This tool reads versions ${readable}.`,
    keyDamaged: "The private key file is damaged.",
    keyMismatch: "The private key file is damaged: its keys do not match.",
    keyNotForShare: (name: string) => `This private key does not belong to ${name}'s share.`,
    pieceFailed: (name: string) =>
      `The piece for ${name} could not be opened. The file may have been changed, or the private key does not belong to it.`,
    noShares: "Add share files.",
    mixedSplits: "These share files come from different splits.",
    notRebuilt: "The shares do not rebuild the secret. They may come from different splits, or a file has been changed.",
    fileTooLarge: (name: string) => `${name} is too large to be a share or key file.`,
    fileNamed: (name: string, reason: string) => `${name}: ${reason}`,
    needOneOfEach: "Load one share file and one private key file.",
    generic: "Something went wrong.",
  },
};