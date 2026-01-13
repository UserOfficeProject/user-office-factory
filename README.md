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
cp example.env .env
npm run dev
```

By default the server listens on port `4500`.

## HTTP API

### Generate exports

`POST /generate/:downloadType/:type`

The response streams the generated output back to the client.

`downloadType`:

- `pdf`
- `xlsx`
- `zip`

Supported `type` values:

- `pdf`: `proposal`, `sample`, `shipment-label`
- `xlsx`: `proposal`, `fap`, `call_fap`
- `zip`: `attachment`, `proposal`

## PDF generation

PDF generation uses Puppeteer.

Concurrency limiting:

- The service uses a semaphore to limit concurrent Puppeteer page work. (see `MAX_CONCURRENT_PDF_GENERATIONS`)
- This protects CPU/memory under load (e.g. “download multiple proposals”).
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

### Puppeteer / PDF Generation

- `MAX_CONCURRENT_PDF_GENERATIONS` (default: `2`) to limit concurrent PDF generations, adjust based on available CPU/memory.
  - When Puppeteer throws like `Protocol error: Connection closed.` errors under load, reduce this value.
- `PDF_GENERATION_TIMEOUT` (default: `60000` ms) to set maximum time for PDF generation
  - When Navigation timeout errors occur, increase this value.
- `PDF_DEBUG_HTML=1` to write the rendered HTML alongside the generated PDF
- `UO_FEATURE_ALLOW_NO_SANDBOX=1` to launch Chromium with `--no-sandbox`

### Resource planning

When deploying the service, consider the following resource guidelines for optimal performance:

(Example load = 32 PDFs with custom template into one PDF (25MB))

Max Ram: 2 GB
CPU cores: 1
`MAX_CONCURRENT_PDF_GENERATIONS` = 2
time: 62721.785 ms

Max Ram: 2 GB
CPU cores: 1.5
`MAX_CONCURRENT_PDF_GENERATIONS` = 3
time: 36377.328 ms

Max Ram: 4 GB
CPU cores: 2
`MAX_CONCURRENT_PDF_GENERATIONS` = 4
time: 23792.517 ms

Note: If the concurrency is set too high for the available resources, you may experience missing pages in the generated PDF.

### Room for improvements

- Use a browser pool instead of a built-in Chromium instance in the application (e.g. Selenium, browserless.io).
