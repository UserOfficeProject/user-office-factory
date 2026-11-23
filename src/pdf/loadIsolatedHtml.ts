import { Page } from 'puppeteer';

const documentUrl = 'https://shipment-label.invalid/';
const contentSecurityPolicy = `sandbox; default-src 'none';
  style-src 'unsafe-inline'; img-src data:; font-src data:;
  base-uri 'none'; form-action 'none'`.replace(/\s+/g, ' ');

export async function loadIsolatedHtml(page: Page, html: string) {
  await page.setJavaScriptEnabled(false);
  await page.setOfflineMode(true);
  await page.setRequestInterception(true);

  // Serve the document in memory so the CSP applies before Chromium parses any
  // template markup. Deny every subsequent request, including navigations.
  let served = false;
  page.on('request', (request) => {
    if (
      !served &&
      request.url() === documentUrl &&
      request.isNavigationRequest() &&
      request.frame() === page.mainFrame()
    ) {
      served = true;

      return request.respond({
        status: 200,
        contentType: 'text/html; charset=utf-8',
        headers: {
          'Content-Security-Policy': contentSecurityPolicy,
          'X-DNS-Prefetch-Control': 'off',
        },
        body: html,
      });
    }

    return request.abort('blockedbyclient');
  });

  await page.goto(documentUrl, { waitUntil: 'networkidle0' });
}
