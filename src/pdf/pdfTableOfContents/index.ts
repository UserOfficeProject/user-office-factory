import muhammara from 'muhammara';

import countOutline from './countOutline';
import countPages from './countPages';
import translatePageNumbers from './translatePageNumbers';
import writeOutline from './writeOutline';

export function createToC(inFile: string, outFile: string, origOutline: any[]) {
  // Start new PDF to contain TOC pages only
  const newPDFWriter = muhammara.createWriter(outFile);
  const outlineSize = countOutline(origOutline);
  const howManyPages = countPages(outlineSize);

  newPDFWriter.appendPDFPagesFromPDF(inFile);
  newPDFWriter.end();
  // End TOC PDF

  // Start final PDF containing bookmarks as well as TOC pages
  const mergingWriter = muhammara.createWriterToModify(outFile);
  const ctx = mergingWriter.getObjectsContext();
  const events = mergingWriter.getEvents();
  const copyCtx = mergingWriter.createPDFCopyingContextForModifiedFile();

  const parser = copyCtx.getSourceDocumentParser(outFile);

  // translate numbers from index to PDF object IDs
  const translatedOutline = origOutline.map((childOutline) =>
    translatePageNumbers(parser, childOutline, howManyPages)
  );

  // write bookmarks
  const outline = writeOutline(ctx, translatedOutline);

  // before writer closes, add outline to PDF
  events.on('OnCatalogWrite', (e) => {
    const d = e.catalogDictionaryContext;
    if (outline !== null) {
      d.writeKey('Outlines')
        .writeObjectReferenceValue(outline)
        .writeKey('PageMode')
        .writeNameValue('UseOutlines');
    }
  });

  // force update, in case it is necessary
  mergingWriter.requireCatalogUpdate();
  mergingWriter.end();
  // End Final PDF
}
