import { promises } from 'fs';
import { extname } from 'path';

import { logger } from '@user-office-software/duo-logger';
import muhammara from 'muhammara';
import puppeteer, { Browser, BrowserContext, PDFOptions } from 'puppeteer';

import { createToC } from './pdfTableOfContents';
import { Semaphore } from './semaphore';
import { BROWSER_WS_ENDPOINT, isRemoteBrowser } from '../config/browserless';
import { generateTmpPath, generateTmpPathWithName } from '../util/fileSystem';

export type TableOfContents = {
  title: string;
  page: number | undefined;
  children: TableOfContents[];
};

const launchOptions = ['--disable-dev-shm-usage'];

if (process.env.UO_FEATURE_ALLOW_NO_SANDBOX === '1') {
  launchOptions.push('--no-sandbox');
}
// Limit concurrent PDF generations to prevent resource exhaustion
// Can be configured via environment variable, defaults to 2
const MAX_CONCURRENT_PDF_GENERATIONS = parseInt(
  process.env.MAX_CONCURRENT_PDF_GENERATIONS || '2',
  10
);

// Configurable timeout for PDF generation (default 60 seconds)
const PDF_GENERATION_TIMEOUT = parseInt(
  process.env.PDF_GENERATION_TIMEOUT || '60000',
  10
);

logger.logInfo('PDF generation settings', {
  maxConcurrent: MAX_CONCURRENT_PDF_GENERATIONS,
  timeoutMs: PDF_GENERATION_TIMEOUT,
  puppeteerLaunchOptions: launchOptions,
});

// Semaphore to limit concurrent PDF generations
// When multiple documents are being generated simultaneously, this helps
// prevent resource exhaustion (CPU, memory) by limiting the number of
// concurrent Puppeteer browser page instances.
// Adjust MAX_CONCURRENT_PDF_GENERATIONS based on your server capacity.
const pdfSemaphore = new Semaphore(MAX_CONCURRENT_PDF_GENERATIONS);

// Browser initialization promise - allows waiting for browser to be ready
// In local mode: callers get one shared browser instance (singleton)
// In remote mode: each call connects to the Browserless cluster
let localBrowserPromise: Promise<Browser> | null = null;

/**
 * Connect to a remote Browserless cluster with retry logic.
 * Each call returns a fresh browser session managed by Browserless.
 */
async function connectRemoteBrowser(maxRetries = 3): Promise<Browser> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await puppeteer.connect({
        browserWSEndpoint: BROWSER_WS_ENDPOINT,
      });
    } catch (e) {
      logger.logWarn(
        `[connectRemoteBrowser] Attempt ${attempt}/${maxRetries} failed`,
        { error: String(e) }
      );
      if (attempt === maxRetries) {
        throw e;
      }
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error('[connectRemoteBrowser] unreachable');
}

/**
 * Get a browser instance.
 * - Remote (BROWSER_WS_ENDPOINT set): connects to Browserless cluster (fresh session per call)
 * - Local (fallback): launches a local Chromium singleton
 */
function getBrowser(): Promise<Browser> {
  if (isRemoteBrowser()) {
    return connectRemoteBrowser();
  }

  // Local fallback: shared singleton browser
  if (!localBrowserPromise) {
    localBrowserPromise = puppeteer
      .launch({ args: launchOptions })
      .catch((e) => {
        logger.logException('Failed to start browser puppeteer', e);
        localBrowserPromise = null; // Reset so we can retry
        throw e;
      });
  }

  return localBrowserPromise;
}

// Note: This function is protected by a semaphore to limit concurrency and prevent resource exhaustion.
//
// Problem: Using `waitUntil: 'networkidle0'` can still produce incomplete rendering.
// Using a separate browser context (empty cache) per page reduces the risk, but it can still happen.
//
// TODO: Implement a deterministic render-wait strategy (template-specific if needed)
export async function generatePdfFromHtml(
  html: string,
  { pdfOptions }: { pdfOptions?: PDFOptions } = {}
): Promise<{ pdfPath: string; toc: TableOfContents[] }> {
  // Acquire semaphore before starting PDF generation
  await pdfSemaphore.acquire();

  const remote = isRemoteBrowser();
  let browser: Browser | undefined = undefined;
  let context: BrowserContext | undefined = undefined;
  try {
    const name = generateTmpPath();
    const pdfPath = `${name}.pdf`;

    if (process.env.PDF_DEBUG_HTML === '1') {
      const htmlPath = `${name}.html`;
      await promises.writeFile(htmlPath, html, 'utf-8');

      logger.logDebug('[generatePdfFromHtml] HTML output:', { htmlPath });
    }

    const start = Date.now();
    browser = await getBrowser();
    context = await browser.createBrowserContext();
    const page = await context.newPage();

    // Set a default navigation timeout
    page.setDefaultNavigationTimeout(PDF_GENERATION_TIMEOUT);
    page.setDefaultTimeout(PDF_GENERATION_TIMEOUT);

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');

    const headingsInfo = await page.evaluate(extractHeadingsInfo);

    if (remote) {
      // Remote browser: omit `path` to get a Buffer (remote FS is not shared)
      const pdfBuffer = await page.pdf({
        format: 'A4',
        margin: { top: 0, left: 0, bottom: 0, right: 0 },
        ...pdfOptions,
      });
      await promises.writeFile(pdfPath, pdfBuffer);
    } else {
      // Local browser: write directly to local filesystem
      await page.pdf({
        path: pdfPath,
        format: 'A4',
        margin: { top: 0, left: 0, bottom: 0, right: 0 },
        ...pdfOptions,
      });
    }

    await page.close();

    logger.logDebug('[generatePdfFromHtml] PDF output:', {
      pdfPath,
      runtime: Date.now() - start,
      remote,
    });

    const toc = generateToc(headingsInfo);

    return { pdfPath, toc };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError(`Error: ${err.message} [generatePdfFromHtml]`, {});

    throw new Error(
      `[generatePdfFromHtml] failed to generate pdf from Html ${err.message}`
    );
  } finally {
    if (context) {
      try {
        await context.close();
      } catch (closeError) {
        logger.logWarn('[generatePdfFromHtml] Failed to close context', {
          error: String(closeError),
        });
      }
    }
    // Remote: disconnect from the cluster (Browserless manages browser lifecycle)
    // Local: close the isolated context (shared browser stays alive)
    if (remote && browser) {
      try {
        browser.disconnect();
      } catch (disconnectError) {
        logger.logWarn('[generatePdfFromHtml] Failed to disconnect browser', {
          error: String(disconnectError),
        });
      }
    }
    pdfSemaphore.release();
  }
}

// Utility function to extract information about headings and their positions using page.evaluate()
function extractHeadingsInfo() {
  const headings = document.querySelectorAll('li.list-index-element');
  const headingsInfo: {
    pageTitle: string;
    pageNumber: string;
    pageParent: string | null;
  }[] = [];
  if (!headings) return headingsInfo;

  headings.forEach((heading) => {
    const pageTitleElement =
      heading.querySelector<HTMLElement>('span.index-value');
    const pageNumberElement = heading
      .querySelector<HTMLElement>('span.links-pages')
      ?.querySelector<HTMLElement>('span.link-page')
      ?.querySelector<HTMLElement>('a');

    if (!pageTitleElement || !pageNumberElement) return;
    const pageTitle = pageTitleElement.innerText;
    const pageNumber = window
      .getComputedStyle(pageNumberElement, ':after')
      .counterReset?.split(' ')[1];
    const pageParent = heading.getAttribute('data-list-index-parent');
    headingsInfo.push({ pageTitle, pageNumber, pageParent });
  });

  const toc = document.querySelector('div#page-1');
  if (toc) {
    toc.remove();
  }

  return headingsInfo;
}

//utility function to generate toc based on headingsInfo. The headingsinfo also contains the link to the parent heading as well. The parent can be found at any level
function generateToc(
  headingsInfo: {
    pageTitle: string;
    pageNumber: string;
    pageParent: string | null;
  }[]
) {
  const toc: TableOfContents[] = [];
  headingsInfo.forEach((headingInfo) => {
    const { pageTitle, pageNumber, pageParent } = headingInfo;
    const page = {
      title: pageTitle,
      page: parseInt(pageNumber) - 2,
      children: [],
    };
    if (pageParent) {
      insertPageIntoParent(toc, pageParent, page);
    } else {
      toc.push(page);
    }
  });

  return toc;
}

//utility function to insert a page into its parent
function insertPageIntoParent(
  toc: TableOfContents[],
  parent: string,
  child: TableOfContents
) {
  toc.forEach((tocItem) => {
    if (tocItem.title === parent) {
      tocItem.children.push(child);
    } else {
      insertPageIntoParent(tocItem.children, parent, child);
    }
  });
}

/**
 * Generate a PDF from a local image file.
 * Reads the image into memory and renders it via generatePdfFromHtml
 * using a base64 data-URI. This works with both local and remote browsers
 * since no file:// URL is needed.
 */
export async function generatePdfFromImageFile(
  imagePath: string,
  { pdfOptions }: { pdfOptions?: PDFOptions } = {}
): Promise<string> {
  try {
    const imageBuffer = await promises.readFile(imagePath);
    const ext = extname(imagePath).slice(1).toLowerCase() || 'png';
    const mimeType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    const base64 = imageBuffer.toString('base64');

    // Use a simple HTML wrapper with the image as a base64 data-URI
    const html = `
      <html>
        <head><style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
          img { max-width: 100%; max-height: 100vh; object-fit: contain; }
        </style></head>
        <body>
          <img src="data:${mimeType};base64,${base64}" />
        </body>
      </html>
    `;

    const { pdfPath } = await generatePdfFromHtml(html, { pdfOptions });

    return pdfPath;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError(`Error in generatePdfFromImageFile: ${err.message}`, {
      imagePath,
    });
    throw new Error(
      `[generatePdfFromImageFile] failed to generate pdf from image ${err.message}`
    );
  }
}

export function getTotalPages(filePath: string): number {
  return muhammara.createReader(filePath).getPagesCount();
}

// TODO: come up with a non-blocking version
export function mergePDF(filePaths: string[]): string {
  const pdfPath = `${generateTmpPath()}.pdf`;

  const pdfWriter = muhammara.createWriter(pdfPath);

  filePaths.forEach((filePath) => pdfWriter.appendPDFPagesFromPDF(filePath));

  logger.logDebug('[mergePDF] PDFs merged', { filePaths, pdfPath });

  pdfWriter.end();

  return pdfPath;
}

export function writeToC(inPath: string, toc: TableOfContents[]) {
  const pdfPath = `${generateTmpPath()}.pdf`;
  createToC(inPath, pdfPath, toc);

  logger.logDebug('[writeToC] ToC created', { inPath, pdfPath });

  return pdfPath;
}

export function writeToCWithName(
  inPath: string,
  toc: TableOfContents[],
  name: string
) {
  const pdfPath = `${generateTmpPathWithName(name)}`;
  createToC(inPath, pdfPath, toc);

  logger.logDebug('[writeToCWithName] ToC created', { inPath, pdfPath });

  return pdfPath;
}

export function generatePuppeteerPdfFooter(footerContent: string) {
  return {
    margin: { top: 0, left: 0, bottom: '9mm', right: 0 },
    displayHeaderFooter: true,
    headerTemplate: '',
    footerTemplate: `<div style="font-size: 8px; padding:0; text-align: center; display:flex; margin: 0 auto;">${footerContent}</div>`,
  };
}
