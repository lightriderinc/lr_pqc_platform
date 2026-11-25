// Measured accuracy of qSearch, shown on /qsearch/accuracy. Every number here
// was measured, not estimated: update this file whenever the scanner changes,
// and re-run the measurements described on the page.

export const MEASURED = {
  date: "2026-11-21",
  scanner: "qSearch 1.4.0",
  /** SHA-256 of qsearch-service/qsearch, the program the website runs. */
  binarySha256: "88fd6e701a23efce763b7afbc4e8e47ad8b01ff29cfaebf9f1d53a5f594921c9",
};

export interface RepoResult {
  repo: string;
  commit: string;
  why: string;
  files: number;
  privateKeyFiles: { truth: number; found: number; falseReports: number };
  certificates: { truth: number; found: number; keyCorrect: number };
  seconds: number;
}

/** Public repositories, pinned to exact commits so anyone can repeat the test. */
export const REPOS: RepoResult[] = [
  {
    repo: "paramiko/paramiko",
    commit: "0e9ccb91e0f9a68f2587233d523ad7fe46e730fe",
    why: "Python SSH library: many key types, and real post-quantum key exchange code",
    files: 193,
    privateKeyFiles: { truth: 21, found: 21, falseReports: 0 },
    certificates: { truth: 0, found: 0, keyCorrect: 0 },
    seconds: 0.02,
  },
  {
    repo: "auth0/node-jsonwebtoken",
    commit: "b924272f29192e12926b5414546f7c5bfcc9579d",
    why: "JavaScript JWT library: RSA, ECDSA and DSA keys, certificates, one expired",
    files: 84,
    privateKeyFiles: { truth: 9, found: 9, falseReports: 0 },
    certificates: { truth: 3, found: 3, keyCorrect: 3 },
    seconds: 0.01,
  },
  {
    repo: "pyca/cryptography",
    commit: "0b3a52a7cb58ecb2d0b07e12a2635586034896d3",
    why: "The hardest test: the test vectors Python's cryptography library is checked against, including deliberately broken keys and certificates",
    files: 1597,
    privateKeyFiles: { truth: 122, found: 116, falseReports: 0 },
    certificates: { truth: 131, found: 130, keyCorrect: 130 },
    seconds: 0.32,
  },
];

/** The internal code-pattern benchmark: labelled uses of cryptography in code and configuration. */
export const BENCHMARK = {
  expected: 50,
  found: 50,
  inCode: 36,
  keyFiles: 14,
  decoys: 5,
  decoysFlagged: 1,
  decoysAsComments: 4,
  sizeErrors: 0,
  extraFindings: 0,
  languages: "Python, JavaScript, Go, Java, C, nginx and OpenSSH configuration, Markdown",
};

export const ROBUSTNESS = { corruptedFiles: 3000, fromOriginals: 316, crashes: 0 };

/** What qSearch misses or gets wrong today, from these measurements and earlier tests. */
export const LIMITS: { title: string; detail: string }[] = [
  {
    title: "Diffie-Hellman private keys are not recognised",
    detail: "3 PKCS#8 Diffie-Hellman private keys in pyca/cryptography were missed.",
  },
  {
    title: "Post-quantum composite SSH keys are not recognised",
    detail: "2 OpenSSH keys combining ML-DSA-44 and Ed25519 were missed. They are post-quantum, so no migration is lost, but the inventory is incomplete.",
  },
  {
    title: "Corrupted private keys are not reported",
    detail: "A deliberately corrupted DSA key was missed. A leaked key is a leak even when damaged, so these should still be flagged.",
  },
  {
    title: "Indented certificates in documentation are missed",
    detail: "1 certificate indented inside reStructuredText documentation was not found.",
  },
  {
    title: "Algorithm names in text can count as use",
    detail: "A log message saying \"RC4 support was removed\" is reported, as are algorithm names in data tables. The inventory review lets you exclude these with a reason.",
  },
  {
    title: "Python docstrings are read as code",
    detail: "Text in triple-quoted docstrings is not yet recognised as documentation.",
  },
  {
    title: "Key sizes are read from the same line only",
    detail: "In Java, initialize(1024) on the line after getInstance(\"RSA\") is not linked to it.",
  },
  {
    title: "Binary certificates and very large files are skipped",
    detail: "Certificates in binary DER form are not read, and files over 4 MB are skipped (4 test-vector files in pyca/cryptography).",
  },
];

/** Problems these measurements found in qSearch itself, and when they were fixed. */
export const FOUND_AND_FIXED: { date: string; detail: string }[] = [
  {
    date: "2026-11-21",
    detail:
      "A certificate with a malformed date made the whole website scan fail. Found with pyca/cryptography's badasn1time.pem; unreadable dates are now reported as unreadable, and one bad file can no longer fail a scan.",
  },
];

export const totals = () => {
  const sum = (pick: (r: RepoResult) => number) => REPOS.reduce((n, r) => n + pick(r), 0);
  return {
    keysTruth: sum((r) => r.privateKeyFiles.truth),
    keysFound: sum((r) => r.privateKeyFiles.found),
    falseReports: sum((r) => r.privateKeyFiles.falseReports),
    certsTruth: sum((r) => r.certificates.truth),
    certsFound: sum((r) => r.certificates.found),
    certsKeyCorrect: sum((r) => r.certificates.keyCorrect),
  };
};