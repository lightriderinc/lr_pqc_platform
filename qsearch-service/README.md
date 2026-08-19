# qSearch Service

A small Python HTTP server that receives a ZIP archive, unpacks it, runs `qsearch` against it, and returns JSON findings.

## Setup

1. Copy `qsearch.exe` (Windows) or `qsearch` (Linux) into this folder.
   - Windows: `Veloce-main\qsearch\target\release\qsearch.exe`
   - Linux: `build/bin/qsearch`

2. Start the service:
   ```
   python server.py
   ```
   It listens on `http://127.0.0.1:8787/scan` by default.

3. Set in `.env.local`:
   ```
   QSEARCH_SERVICE_URL=http://127.0.0.1:8787/scan
   ```

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `QSEARCH_SERVICE_PORT` | `8787` | Port to listen on |
| `QSEARCH_BIN` | `./qsearch.exe` | Path to the qsearch binary |

## Limits

- Max upload: 50 MB
- Max files in ZIP: 5000
- Max extracted size: 200 MB
- Scan timeout: 300 seconds
