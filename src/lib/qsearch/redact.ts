// Findings keep the matched line of code as evidence. That line can also hold
// a password, token or key, which must not be shown, saved or exported. This
// hides likely secrets in the excerpt and keeps the part that was detected.

/** Quoted text this long is hidden unless it contains what was detected. */
const MIN_QUOTED = 20;

const QUOTED = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g;
const ASSIGNED_SECRET =
  /\b(pass(?:word|wd)?|secret|token|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?key)(\s*[:=]\s*)([^\s,;)]+)/gi;
const LONG_HEX = /\b[0-9a-fA-F]{32,}\b/g;
const LONG_BASE64 = /[A-Za-z0-9+/_-]{40,}={0,2}/g;

/** Mixed letters, cases and digits: how keys and tokens look, unlike words and paths. */
const looksRandom = (s: string) => /\d/.test(s) && /[a-z]/.test(s) && /[A-Z]/.test(s);

/**
 * The finding's detail with likely secrets in its code excerpt replaced by
 * [hidden]. Details that are not "pattern …: <code>" are returned unchanged.
 */
export function redactDetail(detail: string): string {
  const m = /^(pattern "(.*?)"(?: \(comment or documentation\))?: )([\s\S]*)$/.exec(detail);
  if (!m) return detail;
  const [, prefix, needle, code] = m;
  const keep = needle.toLowerCase();
  const hidden = code
    .replace(QUOTED, (all, quote: string, inner: string) =>
      inner.length >= MIN_QUOTED && !inner.toLowerCase().includes(keep) ? `${quote}[hidden]${quote}` : all,
    )
    .replace(ASSIGNED_SECRET, (_all, name: string, sep: string) => `${name}${sep}[hidden]`)
    .replace(LONG_HEX, "[hidden]")
    .replace(LONG_BASE64, (run) => (looksRandom(run) ? "[hidden]" : run));
  return prefix + hidden;
}