import muhammara from 'muhammara';

import { TableOfContents } from '..';

export default function translatePageNumbers(
  parser: muhammara.PDFReader,
  outline: TableOfContents,
  offset = 0
): TableOfContents {
  return outline.children
    ? {
        ...outline,
        page:
          outline.page || outline.page === 0
            ? parser.getPageObjectID(outline.page + offset - 1)
            : undefined,
        children: outline.children.map((childOutline) =>
          translatePageNumbers(parser, childOutline, offset)
        ),
      }
    : {
        ...outline,
        page:
          outline.page || outline.page === 0
            ? parser.getPageObjectID(outline.page + offset - 1)
            : undefined,
      };
}
