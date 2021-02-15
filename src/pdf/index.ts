import { promises } from 'fs';

import { logger } from '@esss-swap/duo-logger';
// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import hummus from 'hummus';
import puppeteer, { Browser } from 'puppeteer';

import { generateTmpPath } from '../util/fileSystem';
import { createToC } from './pdfTableOfContents';

export type TableOfContents = {
  title: string;
  page: number;
  children: TableOfContents[];
};

let browser: Browser;

const launchOptions = ['--disable-dev-shm-usage'];

if (process.env.UO_FEATURE_ALLOW_NO_SANDBOX === '1') {
  launchOptions.push('--no-sandbox');
}

logger.logInfo('Launching puppeteer with ', { args: launchOptions });

// TODO: create browser lazily while keeping track of it
// so we don't end up with dozens of browsers
puppeteer
  .launch({ args: launchOptions })
  .then(inst => (browser = inst))
  .catch(e => {
    logger.logException('Failed to start browser puppeteer', e);
  });

export async function generatePdfFromHtml(html: string) {
  const name = generateTmpPath();

  if (process.env.PDF_DEBUG_HTML === '1') {
    const htmlPath = `${name}.html`;
    await promises.writeFile(htmlPath, html, 'utf-8');

    logger.logDebug('[generatePdfFromHtml] HTML output:', { htmlPath });
  }

  const pdfPath = `${name}.pdf`;

  const start = Date.now();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'load' });
  await page.emulateMediaType('screen');
  await page.pdf({
    path: pdfPath,
    margin: { top: 0, left: 0, bottom: 0, right: 0 },
  });

  await page.close();

  logger.logDebug('[generatePdfFromHtml] PDF output:', {
    pdfPath,
    runtime: Date.now() - start,
  });

  return pdfPath;
}

export async function generatePdfFromLink(
  link: string,
  { pdfOptions }: { pdfOptions?: puppeteer.PDFOptions } = {}
) {
  const name = generateTmpPath();

  const pdfPath = `${name}.pdf`;

  const start = Date.now();
  const page = await browser.newPage();
  await page.setViewport({
    width: 1920,
    height: 947,
  });

  await page.goto(link, { waitUntil: 'load' });

  const imgHandle = await page.$('img');
  const width = await page.evaluate(img => img.width, imgHandle);
  const height = await page.evaluate(img => img.height, imgHandle);

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
}

export function getTotalPages(filePath: string): number {
  return hummus.createReader(filePath).getPagesCount();
}

// TODO: come up with a non-blocking version
export function mergePDF(filePaths: string[]): string {
  const pdfPath = `${generateTmpPath()}.pdf`;

  const pdfWriter = hummus.createWriter(pdfPath);

  filePaths.forEach(filePath => pdfWriter.appendPDFPagesFromPDF(filePath));

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

export function generatePuppeteerPdfFooter(footerContent: string) {
  return {
    margin: { top: 0, left: 0, bottom: '9mm', right: 0 },
    displayHeaderFooter: true,
    headerTemplate: '',
    footerTemplate: `<div style="font-size: 8px; padding:0; text-align: center; display:flex; margin: 0 auto;">${footerContent}</div>`,
  };
}
