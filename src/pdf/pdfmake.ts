// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="../types/html-to-pdfmake.d.ts" />

import { promises } from 'fs';
import { join } from 'path';

import { logger } from '@user-office-software/duo-logger';
import htmlToPdfmake from 'html-to-pdfmake';
import { JSDOM } from 'jsdom';
import juice from 'juice';
import pdfMake from 'pdfmake';
import { PDFOptions } from 'puppeteer';

import { generateTmpPath } from '../util/fileSystem';

type PdfMakeDocumentDefinition = {
  content: unknown;
  pageMargins: number[];
  pageOrientation: 'portrait' | 'landscape';
  pageSize: string;
  defaultStyle: { font: string; fontSize: number };
  styles: Record<string, unknown>;
  header?: () => unknown;
  footer?: () => unknown;
};

const fontDirectory = join(__dirname, '../../templates/fonts/free-sans');

export async function generatePdfWithPdfMake(
  html: string,
  pdfOptions?: PDFOptions
): Promise<{ pdfPath: string; toc: [] }> {
  const dom = new JSDOM(html);
  const pdfPath = `${generateTmpPath()}.pdf`;

  try {
    dom.window.document.querySelector('div#page-1')?.remove();
    pdfMake.setFonts({
      FreeSans: {
        normal: join(fontDirectory, 'FreeSans_Regular.ttf'),
        bold: join(fontDirectory, 'FreeSans_Bold.ttf'),
        italics: join(fontDirectory, 'FreeSans_Italic.ttf'),
        bolditalics: join(fontDirectory, 'FreeSans_BoldItalic.ttf'),
      },
    });

    const convertHtml = (value: string, inlineStyles = false) =>
      normalizePdfMakeContent(
        htmlToPdfmake(inlineStyles ? juice(value) : value, {
          window: dom.window,
          ignoreStyles: ['font-family'],
        })
      );
    const document: PdfMakeDocumentDefinition = {
      content: convertHtml(dom.window.document.body.innerHTML),
      pageMargins: getPdfMakeMargins(pdfOptions?.margin),
      pageOrientation: pdfOptions?.landscape ? 'landscape' : 'portrait',
      pageSize: (pdfOptions?.format || 'A4').toUpperCase(),
      defaultStyle: { font: 'FreeSans', fontSize: 9 },
      styles: {
        title: { fontSize: 13.5, bold: true },
        bold: { bold: true },
      },
    };

    if (pdfOptions?.headerTemplate) {
      document.header = () => convertHtml(pdfOptions.headerTemplate!, true);
    }
    if (pdfOptions?.footerTemplate) {
      document.footer = () => convertHtml(pdfOptions.footerTemplate!, true);
    }
    const start = Date.now();
    const pdfBuffer = await pdfMake.createPdf(document).getBuffer();
    await promises.writeFile(pdfPath, pdfBuffer);

    logger.logDebug('[generatePdfFromHtml] PDFMake output:', {
      pdfPath,
      runtime: Date.now() - start,
    });

    return { pdfPath, toc: [] };
  } finally {
    dom.window.close();
  }
}

function getPdfMakeMargins(
  margin: PDFOptions['margin']
): [number, number, number, number] {
  const toPoints = (value: string | number | undefined) => {
    if (value === undefined) return 0;
    if (typeof value === 'number') return value * 0.75;

    const match = value.trim().match(/^(-?\d+(?:\.\d+)?)(mm|cm|in|pt|px)?$/i);
    if (!match) return 0;

    const amount = Number(match[1]);
    switch (match[2]?.toLowerCase()) {
      case 'mm':
        return (amount * 72) / 25.4;
      case 'cm':
        return (amount * 72) / 2.54;
      case 'pt':
        return amount;
      case 'px':
        return amount * 0.75;
      default:
        return amount * 0.75;
    }
  };

  return [
    toPoints(margin?.left),
    toPoints(margin?.top),
    toPoints(margin?.right),
    toPoints(margin?.bottom),
  ];
}

function normalizePdfMakeContent(content: unknown): unknown {
  if (Array.isArray(content)) {
    return content.map(normalizePdfMakeContent);
  }

  if (content && typeof content === 'object') {
    return Object.fromEntries(
      Object.entries(content).map(([key, value]) => [
        key,
        key === 'margin' && Array.isArray(value)
          ? value.map((margin) => (margin === '' ? 0 : margin))
          : normalizePdfMakeContent(value),
      ])
    );
  }

  return content;
}
