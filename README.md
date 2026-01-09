# user-office-factory

Service responsible for rendering and exporting User Office content as:

- PDF documents (proposal PDFs, sample PDFs, shipment labels)
- XLSX exports (proposal and FAP/call FAP)
- ZIP archives (attachments and proposal bundles)

The service exposes a small HTTP API and uses a workflow system to generate the requested output and stream it back to the client.

## Requirements

- Node.js >= 22 (see `package.json#engines`)
- Postgres connectivity (for file/attachment data)
- Chromium (via Puppeteer)

## Quick Start

```bash
npm install
npm run dev
```

By default the server listens on port `4500`.

## HTTP API

### Generate exports

`POST /generate/:downloadType/:type`

`downloadType`:

- `pdf`
- `xlsx`
- `zip`

Supported `type` values:

- `pdf`: `proposal`, `sample`, `shipment-label`
- `xlsx`: `proposal`, `fap`, `call_fap`
- `zip`: `attachment`, `proposal`

Examples:

```bash
# Generate a proposal PDF and save it
curl -X POST \
	http://localhost:4500/generate/pdf/proposal \
	-H 'content-type: application/json' \
	-d '{"data": [/* ... */], "userRole": {"id": 1, "shortCode": "USER", "title": "User"}}' \
	--output proposal.pdf
```

## PDF generation

PDF generation uses Puppeteer.

Concurrency limiting:

- The service uses a semaphore to limit concurrent Puppeteer page work.
- This protects CPU/memory under load (e.g. “download multiple proposals”).

Timeouts:

- HTML rendering uses `page.setContent(..., waitUntil: 'networkidle0')`.
- Navigation and operation timeouts are controlled via `PDF_GENERATION_TIMEOUT`.

## Configuration

Copy and adjust `example.env` as needed.

### Server

- `NODE_PORT` (default: `4500`)
- `NODE_ENV` (`development` / `production`)

### Database

Either provide a full connection string:

- `DATABASE_CONNECTION_STRING`

Or provide discrete settings:

- `DATABASE_HOSTNAME`
- `DATABASE_PORT` (default: `5432`)
- `DATABASE_USER`
- `DATABASE_PASSWORD`
- `DATABASE_DATABASE`

### Puppeteer / PDF

- `MAX_CONCURRENT_PDF_GENERATIONS` (default: `20`) to limit concurrent PDF generations, adjust based on available CPU/memory. 
  - When Puppeteer throws like `Protocol error: Connection closed.` errors under load, reduce this value.
- `PDF_GENERATION_TIMEOUT` (default: `60000` ms) to set maximum time for PDF generation
- `PDF_DEBUG_HTML=1` to write the rendered HTML alongside the generated PDF
- `UO_FEATURE_ALLOW_NO_SANDBOX=1` to launch Chromium with `--no-sandbox`