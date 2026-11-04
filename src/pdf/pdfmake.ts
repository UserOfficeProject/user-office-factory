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
  footer?: (currentPage: number, pageCount: number) => unknown;
};

const pdfMakeTocPlaceholderId = 'pdfmake-toc-placeholder';

const fontDirectory = join(__dirname, '../../templates/fonts/free-sans');

export async function generatePdfWithPdfMake(
  html: string,
  pdfOptions?: PDFOptions
): Promise<{ pdfPath: string; toc: [] }> {
  const dom = new JSDOM(html);
  const pdfPath = `${generateTmpPath()}.pdf`;

  try {
    const tocPage = dom.window.document.querySelector('div#page-1');
    const indexedElements = Array.from(
      dom.window.document.querySelectorAll('[data-book-index]')
    );

    indexedElements.forEach((element, index) => {
      if (!element.id) element.id = `pdfmake-toc-item-${index + 1}`;
    });

    if (tocPage && indexedElements.length > 0) {
      tocPage.replaceChildren();
      tocPage.id = pdfMakeTocPlaceholderId;
    }
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
    const content = convertHtml(dom.window.document.body.innerHTML);
    const document: PdfMakeDocumentDefinition = {
      content: addPdfMakeTableOfContents(content),
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
      document.footer = (currentPage: number, pageCount: number) => {
        const footerTemplate = dom.window.document.createElement('template');
        footerTemplate.innerHTML = pdfOptions.footerTemplate!;

        const pageNumberPlaceholders =
          footerTemplate.content.querySelectorAll('.pageNumber');
        const totalPagesPlaceholders =
          footerTemplate.content.querySelectorAll('.totalPages');

        pageNumberPlaceholders.forEach((placeholder) => {
          placeholder.textContent = String(currentPage);
        });
        totalPagesPlaceholders.forEach((placeholder) => {
          placeholder.textContent = String(pageCount);
        });

        return convertHtml(footerTemplate.innerHTML, true);
      };
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

function addPdfMakeTableOfContents(content: unknown): unknown {
  const tocNode = {
    toc: {
      title: { text: 'Contents', style: 'title' },
      textStyle: { fontSize: 9 },
      numberStyle: { fontSize: 9 },
    },
  };

  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;

    const node = value as Record<string, unknown>;
    if (node.id === pdfMakeTocPlaceholderId) return tocNode;

    const result = Object.fromEntries(
      Object.entries(node).map(([key, child]) => [key, visit(child)])
    );
    if (
      typeof node.id === 'string' &&
      node.id.startsWith('pdfmake-toc-item-')
    ) {
      delete result.id;
      markFirstTextAsTocItem(result, node.id);
    }

    return result;
  };

  return visit(content);
}

function markFirstTextAsTocItem(value: unknown, id: string): boolean {
  if (Array.isArray(value)) {
    return value.some((child) => markFirstTextAsTocItem(child, id));
  }
  if (!value || typeof value !== 'object') return false;

  const node = value as Record<string, unknown>;
  if (typeof node.text === 'string') {
    node.id = id;
    node.tocItem = true;

    return true;
  }

  return Object.values(node).some((child) => markFirstTextAsTocItem(child, id));
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
