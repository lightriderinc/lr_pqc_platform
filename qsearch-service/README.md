# qSearch scanner

The qSearch page (`src/app/qsearch/actions.ts`) runs the program in this
folder on every upload: `qsearch` on Linux, `qsearch.exe` on Windows.

| File | Version | Notes |
| --- | --- | --- |
| `qsearch` | 1.4.0 | Static Linux x86-64 build. Checksum in `qsearch.sha256`, verified by CI |
| `qsearch.exe` | 1.0.0 | Older build; results on Windows differ from Linux |

Source: the Veloce repository, `qsearch/`. The 1.4.0 build includes changes
not yet merged into Veloce: the key and certificate collector, whole-word and
any-case matching, new patterns, and low confidence for comments. Merge them
into Veloce before building a replacement from it, or these fixes are lost.
Replacing `qsearch` also means updating `qsearch.sha256` in the same commit.

The scanner runs with an empty environment, so it never sees the website's
secrets. `server.py` is a standalone HTTP wrapper; the website does not use it.
