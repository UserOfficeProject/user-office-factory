declare module 'html-to-pdfmake' {
  function htmlToPdfmake(
    html: string,
    options: { window: Window; ignoreStyles: string[] }
  ): unknown;

  export default htmlToPdfmake;
}

declare module 'jsdom' {
  export class JSDOM {
    constructor(html: string);
    window: Window & { close: () => void };
  }
}

declare module 'pdfmake' {
  const pdfMake: {
    createPdf(document: {
      content: unknown;
      pageMargins: number[];
      pageOrientation?: 'portrait' | 'landscape';
      pageSize: string;
      defaultStyle: { font: string; fontSize: number };
      styles?: Record<string, unknown>;
      background?: unknown;
      header?: unknown;
      footer?: unknown;
    }): { getBuffer: () => Promise<Buffer> };
    setFonts(fonts: Record<string, Record<string, string>>): void;
  };

  export default pdfMake;
}
