import { promises } from 'fs';

import { logger } from '@user-office-software/duo-logger';
import muhammara from 'muhammara';
import puppeteer, { Browser, BrowserContext, PDFOptions } from 'puppeteer';

import { createToC } from './pdfTableOfContents';
import { Semaphore } from './semaphore';
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
// Callers get one shared browser instance
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({ args: launchOptions }).catch((e) => {
      logger.logException('Failed to start browser puppeteer', e);
      browserPromise = null; // Reset so we can retry
      throw e;
    });
  }

  return browserPromise;
}

export async function generatePdfFromHtml(
  html: string,
  { pdfOptions }: { pdfOptions?: PDFOptions } = {}
): Promise<{ pdfPath: string; toc: TableOfContents[] }> {
  const name = generateTmpPath();
  const pdfPath = `${name}.pdf`;
  let context: BrowserContext | undefined = undefined;

  if (process.env.PDF_DEBUG_HTML === '1') {
    const htmlPath = `${name}.html`;
    await promises.writeFile(htmlPath, html, 'utf-8');

    logger.logDebug('[generatePdfFromHtml] HTML output:', { htmlPath });
  }

  // Acquire semaphore to limit concurrent PDF generations
  await pdfSemaphore.acquire();

  try {
    const start = Date.now();
    context = await (await getBrowser()).createBrowserContext();
    const page = await context.newPage();

    // Set a default navigation timeout
    page.setDefaultNavigationTimeout(PDF_GENERATION_TIMEOUT);
    page.setDefaultTimeout(PDF_GENERATION_TIMEOUT);

    await page.setContent(html, { waitUntil: 'networkidle0' });
    await page.emulateMediaType('screen');

    const headingsInfo = await page.evaluate(extractHeadingsInfo);

    await page.pdf({
      path: pdfPath,
      format: 'A4',
      margin: { top: 0, left: 0, bottom: 0, right: 0 },
      ...pdfOptions,
    });

    await page.close();

    logger.logDebug('[generatePdfFromHtml] PDF output:', {
      pdfPath,
      runtime: Date.now() - start,
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
    // Always close the context and release the semaphore
    if (context) {
      try {
        await context.close();
      } catch (closeError) {
        logger.logWarn('[generatePdfFromHtml] Failed to close context', {
          error: String(closeError),
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

export async function generatePdfFromLink(
  link: string,
  { pdfOptions }: { pdfOptions?: PDFOptions } = {}
): Promise<string> {
  const name = generateTmpPath();
  const pdfPath = `${name}.pdf`;
  let context: BrowserContext | undefined = undefined;

  // Acquire semaphore to limit concurrent PDF generations
  await pdfSemaphore.acquire();

  const start = Date.now();
  try {
    const browser = await getBrowser();
    context = await browser.createBrowserContext();
    const page = await context.newPage();

    // Set a default navigation timeout
    page.setDefaultNavigationTimeout(PDF_GENERATION_TIMEOUT);
    page.setDefaultTimeout(PDF_GENERATION_TIMEOUT);

    await page.setViewport({
      width: 1920,
      height: 947,
    });

    await page.goto(link, { waitUntil: 'load' });

    const imgHandle = await page.$('img');
    const width = (await page.evaluate((img) => img?.width, imgHandle)) || 0;
    const height = (await page.evaluate((img) => img?.height, imgHandle)) || 0;

    await page.pdf({
      path: pdfPath,
      margin: { top: 0, left: 0, bottom: 0, right: 0 },
      landscape: width > height,
      ...pdfOptions,
    });

    await page.close();

    logger.logDebug('[generatePdfFromLink] PDF output:', {
      pdfPath,
      runtime: Date.now() - start,
    });

    return pdfPath;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.logError(`Error in generatePdfFromLink: ${err.message}`, {});

    throw new Error(
      `[generatePdfFromLink] failed to generate pdf from link ${err.message}`
    );
  } finally {
    // Always close the context and release the semaphore
    if (context) {
      try {
        await context.close();
      } catch (closeError) {
        logger.logWarn('[generatePdfFromLink] Failed to close context', {
          error: String(closeError),
        });
      }
    }
    pdfSemaphore.release();
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
