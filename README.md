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

PDF generation uses Puppeteer. The service supports two modes:

### Built-in Chromium (default)

By default, the service launches a local Chromium instance via Puppeteer. This is the simplest setup and maintains backward compatibility.

- No additional configuration required
- Chromium is bundled with Puppeteer
- Recommended `MAX_CONCURRENT_PDF_GENERATIONS`: 2 (depending on resources)

### Remote Browserless cluster

For better scalability and resource isolation, you can offload browser rendering to a remote [Browserless](https://www.browserless.io/) cluster. This separates the Node.js application from the Chrome rendering workload.

**Why use a remote browser instead of built-in Chromium?**

- **Better scalability**: Browser capacity can be scaled independently from API replicas.
- **Resource isolation**: Chrome CPU/RAM spikes do not directly impact the Node.js process.
- **Higher throughput**: Multiple factory instances can share one Browserless cluster.
- **Operational flexibility**: Browser lifecycle, limits, and upgrades are managed in one place.
- **Improved resilience**: Browser crashes are isolated from the app and easier to recover from.

**Environment variables for Browserless:**

- `BROWSER_WS_ENDPOINT` - WebSocket endpoint of the Browserless cluster (e.g., `ws://browserless:3000`)
- `FACTORY_BASE_URL` - Base URL where the factory service is reachable by the remote browser (e.g., `http://factory:4500`)

When `BROWSER_WS_ENDPOINT` is set, the service connects to the remote cluster instead of launching local Chromium. Each PDF generation creates a fresh browser session managed by Browserless.

**Recommended `MAX_CONCURRENT_PDF_GENERATIONS` for Browserless:** 5-10 (depending on cluster size and resources)

### Switching modes (built-in <-> remote)

Use environment variables to select the browser mode.

#### Use built-in Chromium

1. Do not set `BROWSER_WS_ENDPOINT`.
2. Optionally remove `FACTORY_BASE_URL` (it is not required in built-in mode).
3. Set `MAX_CONCURRENT_PDF_GENERATIONS` conservatively (start around `2`).
4. Optional: set `UO_FEATURE_ALLOW_NO_SANDBOX=1` only if your runtime requires it.

#### Use remote Browserless

1. Start/reach a Browserless service.
2. Set `BROWSER_WS_ENDPOINT` to the Browserless WebSocket endpoint.
3. Set `FACTORY_BASE_URL` to the factory URL resolvable by Browserless.
4. Tune `MAX_CONCURRENT_PDF_GENERATIONS` to Browserless capacity (for one pod, approximate upper bound is `CONCURRENT + QUEUED`).
5. Ignore `UO_FEATURE_ALLOW_NO_SANDBOX` (it only affects built-in Chromium launch).

### Concurrency limiting

- The service uses a semaphore to limit concurrent Puppeteer page work. (see `MAX_CONCURRENT_PDF_GENERATIONS`)
- This protects CPU/memory under load (e.g. “download multiple proposals”).
- Navigation and operation timeouts are controlled via `PDF_GENERATION_TIMEOUT`.

## Configuration

Copy and adjust `example.env` as needed.

### Server

- `NODE_PORT` (default: `4500`)
- `NODE_ENV` (`development` / `production`)
- `REQUEST_BODY_LIMIT` (default: `20mb`) maximum accepted request body size for JSON/urlencoded payloads
  - Increase this when `/generate` requests include large embedded template/data payloads

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
  - Built-in Chromium: recommended max. 2-4
  - Remote Browserless cluster: 5-10 (depending on cluster size and resources)
  - When Puppeteer throws like `Protocol error: Connection closed.` errors under load, reduce this value.
- `PDF_GENERATION_TIMEOUT` (default: `60000` ms) to set maximum time for PDF generation
  - When Navigation timeout errors occur, increase this value.
- `PDF_DEBUG_HTML=1` to write the rendered HTML alongside the generated PDF
- `UO_FEATURE_ALLOW_NO_SANDBOX=1` to launch Chromium with `--no-sandbox`
  - Use only when your runtime cannot support Chromium sandboxing (common in some containers).
  - Applies only to built-in Chromium mode (`puppeteer.launch`), ignored in Browserless mode. Security note: disabling sandbox reduces browser process isolation.

### Browserless (Remote Browser)

See [k8s/browserless/](k8s/browserless/README.md) for Kubernetes deployment instructions.

- `BROWSER_WS_ENDPOINT` - WebSocket endpoint of the Browserless cluster
  - Examples:
    - Docker Compose: `ws://browserless:3000`
    - Kubernetes: `ws://browserless.default.svc.cluster.local:3000`
  - When set, PDF generation uses the remote browser cluster instead of local Chromium
- `FACTORY_BASE_URL` - Base URL of the factory app, used by the remote browser to fetch static assets (CSS, fonts, images, JS)
  - Defaults to `http://localhost:<NODE_PORT>` for local development
  - Must be set to a hostname resolvable by the Browserless container
  - Examples:
    - Docker Compose: `http://factory:4500`
    - Local dev + Browserless in Docker: `http://host.docker.internal:4500`
    - Kubernetes: `http://<service-name>.<namespace>.svc.cluster.local:<port>`

### Resource planning

Set `MAX_CONCURRENT_PDF_GENERATIONS` based on the browser mode and available capacity:

- **Built-in Chromium mode**: start around `2` and increase only if CPU/memory headroom allows it.
- **Remote Browserless mode**: size against Browserless capacity.
  - Approximate upper bound per Browserless pod is `CONCURRENT + QUEUED`.
  - Example: `CONCURRENT=5`, `QUEUED=10` => upper bound `15`.
  - If multiple Browserless pods are behind a load balancer, total cluster capacity scales by pod count.

Practical tuning guidance:

- If you see browser connection/queue errors, reduce `MAX_CONCURRENT_PDF_GENERATIONS`.
- If requests time out, increase `PDF_GENERATION_TIMEOUT` and/or lower concurrency.
- Increase concurrency gradually while monitoring CPU, memory, error rate, and PDF completeness.

## Custom Templates

When creating custom templates that reference factory-hosted assets (images, fonts, CSS, JS), use the `{{factoryBaseUrl}}` Handlebars helper instead of hardcoding URLs.

- **Built-in Chromium mode**: The browser runs locally and can access `localhost` directly
- **Browserless mode**: The remote browser cannot resolve `localhost` - it needs the factory's network-reachable URL

Using `{{factoryBaseUrl}}` ensures templates work in both modes.

### Example

**Incorrect** (hardcoded localhost - breaks with Browserless):
```html
<img src="http://localhost:4500/static/images/logo.png" />
<link rel="stylesheet" href="http://localhost:4500/static/css/custom.css">
```

**Correct** (using helper - works in all modes):
```html
<img src="{{factoryBaseUrl}}/static/images/logo.png" />
<link rel="stylesheet" href="{{factoryBaseUrl}}/static/css/custom.css">
```

The `{{factoryBaseUrl}}` helper is automatically available in all templates and resolves to:
- `http://localhost:4500` when using built-in Chromium (default)
- The value of `FACTORY_BASE_URL` env var when using Browserless

## Future improvements

- Improve the HTML render waiting strategy before PDF generation to ensure pages are fully rendered.
- After the waiting strategy is in place, avoid creating a new browser context for every request; evaluate reusing the default/shared context to improve cache reuse for static assets.
- Leverage static asset caching (`Cache-Control` / `max-age`) together with context reuse to reduce repeated CSS/font/image fetches.
- Retry logic for transient PDF generation errors (e.g., navigation timeout error etc...)
- Config class to centralize and validate environment variable parsing and defaults.