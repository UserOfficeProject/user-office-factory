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

import type { TableOfContents } from './index';

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

const fontDirectory = join(__dirname, '../../templates/fonts/free-sans');

export async function generatePdfWithPdfMake(
  html: string,
  pdfOptions?: PDFOptions
): Promise<{ pdfPath: string; toc: TableOfContents[] }> {
  const dom = new JSDOM(html);
  const pdfPath = `${generateTmpPath()}.pdf`;

  try {
    const indexedElements = Array.from(
      dom.window.document.querySelectorAll('[data-book-index]')
    );

    const indexedEntries = indexedElements.map((element, index) => {
      if (!element.id) element.id = `pdfmake-toc-item-${index + 1}`;

      return {
        id: element.id,
        title: element.getAttribute('data-book-index') || '',
        parent: element.getAttribute('data-book-index-parent'),
      };
    });
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
      content: markPdfMakeTocItems(
        content,
        new Set(indexedEntries.map(({ id }) => id))
      ),
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
    const pdf = pdfMake.createPdf(document);
    const pdfDocument = (await pdf.getStream()) as {
      _pdfMakePages?: Array<{ items: Array<{ id?: string }> }>;
    };
    const pageNumbers = findTocPageNumbers(
      pdfDocument._pdfMakePages,
      indexedEntries
    );
    const pdfBuffer = await pdf.getBuffer();
    await promises.writeFile(pdfPath, pdfBuffer);

    logger.logDebug('[generatePdfFromHtml] PDFMake output:', {
      pdfPath,
      runtime: Date.now() - start,
    });

    return {
      pdfPath,
      toc: buildTableOfContents(indexedEntries, pageNumbers),
    };
  } finally {
    dom.window.close();
  }
}

function markPdfMakeTocItems(content: unknown, ids: Set<string>): unknown {
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!value || typeof value !== 'object') return value;

    const node = value as Record<string, unknown>;
    const result = Object.fromEntries(
      Object.entries(node).map(([key, child]) => [key, visit(child)])
    );
    if (typeof node.id === 'string' && ids.has(node.id)) {
      delete result.id;
      markFirstTextWithId(result, node.id);
    }

    return result;
  };

  return visit(content);
}

function markFirstTextWithId(value: unknown, id: string): boolean {
  if (Array.isArray(value)) {
    return value.some((child) => markFirstTextWithId(child, id));
  }
  if (!value || typeof value !== 'object') return false;

  const node = value as Record<string, unknown>;
  if (
    typeof node.text === 'string' &&
    node.text.trim().length > 0 &&
    typeof node.id !== 'string'
  ) {
    node.id = id;

    return true;
  }

  return Object.values(node).some((child) => markFirstTextWithId(child, id));
}

type IndexedEntry = {
  id: string;
  title: string;
  parent: string | null;
};

function findTocPageNumbers(
  pages: Array<{ items: Array<{ id?: string }> }> | undefined,
  entries: IndexedEntry[]
): Map<string, number> {
  const ids = new Set(entries.map(({ id }) => id));
  const pageNumbers = new Map<string, number>();

  pages?.forEach((page, pageIndex) => {
    page.items.forEach((item) => {
      if (item.id && ids.has(item.id)) pageNumbers.set(item.id, pageIndex);
    });
  });

  return pageNumbers;
}

function buildTableOfContents(
  entries: IndexedEntry[],
  pageNumbers: Map<string, number>
): TableOfContents[] {
  const toc: TableOfContents[] = [];
  entries.forEach((entry) => {
    const item: TableOfContents = {
      title: entry.title,
      page: pageNumbers.get(entry.id),
      children: [],
    };
    if (entry.parent) {
      insertTocItem(toc, entry.parent, item);
    } else {
      toc.push(item);
    }
  });

  return toc;
}

function insertTocItem(
  items: TableOfContents[],
  parentTitle: string,
  child: TableOfContents
): boolean {
  for (const item of items) {
    if (item.title === parentTitle) {
      item.children.push(child);

      return true;
    }
    if (insertTocItem(item.children, parentTitle, child)) {
      return true;
    }
  }

  return false;
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
