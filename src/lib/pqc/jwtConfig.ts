// Configuration for the Token Forgery Check.
//
// Every algorithm, limit, and piece of text lives here. jwtInspect.ts holds
// logic only. Sources: RFC 7518 (JWA), RFC 9864 (fully-specified algorithms),
// RFC 9964 (ML-DSA for JOSE), RFC 6265bis (cookies), nginx and Apache source.

export type QuantumStatus = "broken" | "safe" | "insecure" | "unknown";

export interface AlgInfo {
  family: string;
  status: QuantumStatus;
  note: string;
}

const SHOR_SIG =
  "A large enough quantum computer running Shor's algorithm could work out the private key from the public key and forge tokens.";

const RSA_SIG: AlgInfo = { family: "RSA signature", status: "broken", note: SHOR_SIG };
const EC_SIG: AlgInfo = { family: "Elliptic curve signature", status: "broken", note: SHOR_SIG };
const HMAC: AlgInfo = {
  family: "HMAC with a shared secret",
  status: "safe",
  note: "Quantum computers only halve its strength. But it is only as strong as the secret: a short or guessable secret can be cracked today, with no quantum computer.",
};
const ML_DSA: AlgInfo = {
  family: "ML-DSA (FIPS 204, RFC 9964)",
  status: "safe",
  note: "Post-quantum signature. No known quantum attack.",
};

/** Signing algorithms (the "alg" of a three-part token). */
export const JWS_ALGORITHMS: Record<string, AlgInfo> = {
  HS256: HMAC,
  HS384: HMAC,
  HS512: HMAC,
  RS256: RSA_SIG,
  RS384: RSA_SIG,
  RS512: RSA_SIG,
  PS256: RSA_SIG,
  PS384: RSA_SIG,
  PS512: RSA_SIG,
  ES256: EC_SIG,
  ES384: EC_SIG,
  ES512: EC_SIG,
  ES256K: EC_SIG,
  EdDSA: EC_SIG,
  Ed25519: EC_SIG,
  Ed448: EC_SIG,
  "ML-DSA-44": ML_DSA,
  "ML-DSA-65": ML_DSA,
  "ML-DSA-87": ML_DSA,
  none: {
    family: "No signature",
    status: "insecure",
    note: "The token is not signed. Anyone can change it today, with no quantum computer.",
  },
};

const HNDL =
  "Tokens recorded today could be decrypted once a large enough quantum computer exists (harvest now, decrypt later).";

const RSA_KEM: AlgInfo = { family: "RSA key encryption", status: "broken", note: HNDL };
const ECDH: AlgInfo = { family: "Elliptic curve key agreement", status: "broken", note: HNDL };
const SYMMETRIC_KEM: AlgInfo = {
  family: "Symmetric key",
  status: "safe",
  note: "Uses a shared symmetric key. Quantum computers only halve its strength.",
};

/** Key management algorithms (the "alg" of a five-part, encrypted token). */
export const JWE_ALGORITHMS: Record<string, AlgInfo> = {
  RSA1_5: RSA_KEM,
  "RSA-OAEP": RSA_KEM,
  "RSA-OAEP-256": RSA_KEM,
  "RSA-OAEP-384": RSA_KEM,
  "RSA-OAEP-512": RSA_KEM,
  "ECDH-ES": ECDH,
  "ECDH-ES+A128KW": ECDH,
  "ECDH-ES+A192KW": ECDH,
  "ECDH-ES+A256KW": ECDH,
  dir: SYMMETRIC_KEM,
  A128KW: SYMMETRIC_KEM,
  A192KW: SYMMETRIC_KEM,
  A256KW: SYMMETRIC_KEM,
  A128GCMKW: SYMMETRIC_KEM,
  A192GCMKW: SYMMETRIC_KEM,
  A256GCMKW: SYMMETRIC_KEM,
};

export const UNKNOWN_ALG: AlgInfo = {
  family: "Unknown algorithm",
  status: "unknown",
  note: "This algorithm is not in the standard JOSE list.",
};

/** Shown for quantum-vulnerable signatures. Signatures are not "harvest now, decrypt later". */
export const SIGNATURE_RISK_NOTE =
  "What matters is how long the signing key stays in use, not how long this token lasts. Move to a post-quantum signing key before large quantum computers exist.";

/** ML-DSA levels from RFC 9964, smallest first. */
export const ML_DSA_LEVELS = ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"] as const;
export type MlDsaLevel = (typeof ML_DSA_LEVELS)[number];

/** Where a token travels, and how large it can be there. */
export interface SizeLimit {
  id: "cookie" | "apache" | "nginx";
  label: string;
  /** Maximum bytes of the measured string. */
  maxBytes: number;
  /** Text added before the token in the measured string. */
  prefix: string;
  consequence: string;
  source: string;
}

/** Cookie name assumed when measuring the cookie limit. */
export const COOKIE_NAME = "session";

export const SIZE_LIMITS: SizeLimit[] = [
  {
    id: "cookie",
    label: "Browser cookie",
    maxBytes: 4096,
    prefix: COOKIE_NAME, // name + value count toward the limit, "=" does not
    consequence:
      "Browsers ignore a cookie this large. Unless your login library splits large cookies into several, the session is lost.",
    source: "RFC 6265bis",
  },
  {
    id: "apache",
    label: "Authorization header, Apache default",
    maxBytes: 8190,
    prefix: "Authorization: Bearer ",
    consequence: "Apache rejects the request unless its limit is raised.",
    source: "Apache httpd, LimitRequestFieldSize",
  },
  {
    id: "nginx",
    label: "Authorization header, nginx default",
    maxBytes: 8192,
    prefix: "Authorization: Bearer ",
    consequence: "nginx rejects the request unless its limit is raised.",
    source: "nginx, large_client_header_buffers",
  },
];

/** Language used for dates and relative times. */
export const LOCALE = "en-US";

/** Longest input the inspector reads. Real tokens are a few KB. */
export const MAX_TOKEN_CHARS = 64 * 1024;

/** Claims shown as dates when present. RFC 7519, section 4.1. */
export const TIME_CLAIMS: Record<string, string> = {
  iat: "Issued",
  nbf: "Valid from",
  exp: "Expires",
};

/**
 * Sample tokens are signed in the browser with a freshly made key. Only
 * algorithms every current browser can create are offered.
 */
export const SAMPLE = {
  algorithms: ["RS256", "ES256", "HS256"] as const,
  defaultAlgorithm: "RS256",
  /** Bytes of random secret for HS256 samples. */
  hmacSecretBytes: 32,
  lifetimeSeconds: 3600,
  claims: {
    iss: "https://sample.invalid",
    sub: "sample-user",
    aud: "https://api.sample.invalid",
  },
};
export type SampleAlgorithm = (typeof SAMPLE.algorithms)[number];

/** Badge text and style for each status. Style names come from components/ui/Badge. */
export const STATUS_DISPLAY: Record<QuantumStatus, { label: string; variant: "vulnerable" | "ready" | "warn" | "neutral" }> = {
  broken: { label: "Quantum-vulnerable", variant: "vulnerable" },
  safe: { label: "Not broken by quantum", variant: "ready" },
  insecure: { label: "Insecure today", variant: "warn" },
  unknown: { label: "Unknown", variant: "neutral" },
};

export const TEXT = {
  title: "Token Forgery Check",
  intro: "Paste a login token. See if a quantum computer could forge it.",
  tokenLabel: "Token",
  tokenPlaceholder: "Paste a token, for example eyJhbGciOi...",
  sampleButton: "Make a sample token",
  sampleBanner: "Sample token, signed in your browser with a new key. Its key is filled in below.",
  noAlg: "no alg",
  encrypted: "This token is encrypted. Its claims cannot be read without the decryption key.",
  expiry: {
    expired: (rel: string) => `Expired ${rel}`,
    valid: (rel: string) => `Expires ${rel}`,
    notYet: (rel: string) => `Becomes valid ${rel}`,
    none: "No expiry date",
  },
  size: (n: number) => `${n.toLocaleString("en-US")} characters`,
  details: "Show details",
  dates: "Dates",
  header: "Header",
  payload: "Payload",
  sizeChecks: "Where this token fits",
  fits: (spare: number) => `fits, ${spare} bytes to spare`,
  tooLarge: (over: number, consequence: string) => `too large by ${over} bytes. ${consequence}`,
  verifyTitle: "Verify the signature",
  verifyButton: "Verify",
  secretPlaceholder: "Paste the shared secret",
  keyPlaceholder: "Paste the public key: PEM, certificate, a JWK, or a whole key set such as Google's",
  secretWarning: "Use a test secret only. Never paste a secret that signs real logins.",
  valid: "Valid signature.",
  pqTitle: "The same token, post-quantum",
  pqIntro: "Signs the same claims with ML-DSA (RFC 9964) using a new key, then verifies it.",
  pqButton: "Make ML-DSA versions",
  pqWorking: "Signing",
  pqVerified: "verified",
  pqFailed: "verification failed",
  copyToken: "Copy token",
  copyKey: "Copy public key",
  cookieAdvice: (fit: string[], noFit: string[]) => {
    const list = (items: string[]) => new Intl.ListFormat("en-US", { type: "conjunction" }).format(items);
    if (noFit.length === 0) return "In a cookie: every ML-DSA version of this token fits.";
    if (fit.length === 0) return "In a cookie: no ML-DSA version of this token fits. Send it in the Authorization header instead.";
    return `In a cookie: ${list(fit)} ${fit.length === 1 ? "fits" : "fit"}; ${list(noFit)} ${noFit.length === 1 ? "does" : "do"} not. Use ${fit[0]}, or send the token in the Authorization header.`;
  },
  errors: {
    empty: "Paste a token.",
    tooLong: "This is too long to be a token.",
    parts: "A token has three parts separated by dots, or five if it is encrypted.",
    noAlg: "The header has no algorithm (alg).",
    badChars: (what: string) => `The ${what} contains characters that are not allowed.`,
    badBase64: (what: string) => `The ${what} is not valid base64url.`,
    notJson: (what: string) => `The ${what} is not a JSON object.`,
    keyUnusable: (alg: string) =>
      `This key could not be used with ${alg}. Either it is the wrong type of key, or this browser cannot verify ${alg}.`,
    keyFormat: "Paste a public key as PEM (BEGIN PUBLIC KEY), a certificate, a JWK, or a key set. A key ID (kid) on its own is not a key.",
    noMatchingKey: (kid: string) => `No key in this set has the token's key ID (${kid}). The set may have changed since the token was issued.`,
    noKid: "This token has no key ID (kid), so a key set cannot be used. Paste the single key instead.",
    mlDsaJwk: "For ML-DSA, paste the public key as a JWK with kty AKP.",
    mlDsaJwkFields: (alg: string) => `The key must be a JWK with kty "AKP" and alg "${alg}".`,
    keyLength: "The public key has the wrong length.",
    encryptedVerify: "Encrypted tokens cannot be verified here.",
    noKey: "Paste the key to verify with.",
    unsupported: (alg: string) => `${alg} is not a supported algorithm.`,
    noSignature: "The token has no signature to verify.",
    mismatch: "The signature does not match this key or token.",
    checkFailed: "The token could not be checked with this key.",
    onlySigned: "Only signed tokens can be compared.",
    sampleFailed: (alg: string) => `This browser could not create a ${alg} key.`,
    generic: "Something went wrong.",
  },
};