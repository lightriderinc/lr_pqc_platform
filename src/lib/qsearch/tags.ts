// Notes attached to findings: where they sit (test files, comments) and what
// needs attention beyond the algorithm (committed private keys, expired
// certificates). Worked out from each finding's own fields, so they apply to
// saved scans too. Pure: runs in the browser.

export type Tag = "test" | "comment" | "privateKey" | "expired";

interface Taggable {
  asset: string;
  confidence: string;
  service: string;
  certificate?: { notValidAfter: string } | null;
}

/** Folder names that hold tests or test data. */
const TEST_DIRS = new Set([
  "test",
  "tests",
  "__tests__",
  "spec",
  "specs",
  "testdata",
  "test-data",
  "fixtures",
  "__fixtures__",
  "__mocks__",
  "e2e",
]);

/** File names that are tests, by the usual convention of each language. */
const TEST_FILES = [
  /\.(test|spec)\.[cm]?[jt]sx?$/i, // app.test.js, app.spec.ts
  /_test\.(go|py|rb|c|cc|cpp)$/i, // keys_test.go
  /^test_.*\.py$/i, // test_keys.py
  /^tests?\.py$/i,
  /(Test|Tests|Spec)\.(java|kt|scala|cs)$/, // KeysTest.java
  /_spec\.rb$/i,
];

export function isTestPath(asset: string): boolean {
  const parts = asset.replace(/\\/g, "/").split("/").filter((p) => p && p !== ".");
  const file = parts.pop() ?? "";
  return parts.some((p) => TEST_DIRS.has(p.toLowerCase())) || TEST_FILES.some((r) => r.test(file));
}

/** In a comment or documentation, as qSearch reports it. */
export const isComment = (f: Taggable) => f.confidence === "low";

/** A private key stored in the scanned files. */
export const isPrivateKey = (f: Taggable) => f.service === "key material at rest";

/** A certificate already expired when the scan ran. */
export const isExpired = (f: Taggable, at: Date) =>
  !!f.certificate && new Date(f.certificate.notValidAfter).getTime() < at.getTime();

export function tagsOf(f: Taggable, at: Date): Tag[] {
  const tags: Tag[] = [];
  if (isPrivateKey(f)) tags.push("privateKey");
  if (isExpired(f, at)) tags.push("expired");
  if (isTestPath(f.asset)) tags.push("test");
  if (isComment(f)) tags.push("comment");
  return tags;
}

export const TAGS: Record<Tag, { label: string; note: string; variant: "vulnerable" | "warn" | "neutral" }> = {
  privateKey: {
    label: "Private key",
    note: "A private key is stored in the scanned files. Treat it as exposed: replace it, and remove it from the repository and its history.",
    variant: "vulnerable",
  },
  expired: {
    label: "Expired",
    note: "This certificate had expired when the scan ran.",
    variant: "vulnerable",
  },
  test: {
    label: "Test file",
    note: "In a test file or test data, which usually does not run in production.",
    variant: "neutral",
  },
  comment: {
    label: "Comment or docs",
    note: "In a comment or documentation, not in code that runs. Not counted in the totals.",
    variant: "warn",
  },
};