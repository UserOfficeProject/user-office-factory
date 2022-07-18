import muhammara from 'muhammara';

import { TableOfContents } from '..';
import getTOCText from './getTOCText';
import translatePageNumbers from './translatePageNumbers';
import writeLinks from './writeLinks';
import writeOutline from './writeOutline';

export function createToC(
  inFile: string,
  outFile: string,
  origOutline: TableOfContents[]
) {
  // Start new PDF to contain TOC pages only
  const newPDFWriter = muhammara.createWriter(outFile);
  // const outlineSize = countOutline(origOutline);
  // const howManyPages = countPages(outlineSize);
  const howManyPages = 1;
  const tocText = getTOCText(origOutline, howManyPages);
  //const tocPageSize = addTOCPages(newPDFWriter, tocText, font)
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

  // create link annotations for TOC to locations in file
  for (let i = 0; i < howManyPages; i++) {
    writeLinks(ctx, copyCtx, parser, i, tocText, howManyPages, 0);
  }

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
