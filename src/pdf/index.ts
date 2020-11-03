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

export async function generatePdfFromHtml(html: string) {
  if (!browser) {
    browser = await puppeteer.launch({ args: ['--disable-dev-shm-usage'] });
  }

  const name = generateTmpPath();

  if (process.env.PDF_DEBUG_HTML === '1') {
    const htmlPath = `${name}.html`;
    await promises.writeFile(htmlPath, html, 'utf-8');

    logger.logDebug('[generatePdfFromHtml] HTML output:', { htmlPath });
  }

  const pdfPath = `${name}.pdf`;

  const page = await browser.newPage();
  await page.goto(`data:text/html;charset=UTF-8,${html}`, {
    waitUntil: 'networkidle0',
  });
  await page.emulateMediaType('screen');
  await page.pdf({
    path: pdfPath,
    margin: { top: 0, left: 0, bottom: 0, right: 0 },
  });

  await page.close();

  logger.logDebug('[generatePdfFromHtml] PDF output:', { pdfPath });

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
