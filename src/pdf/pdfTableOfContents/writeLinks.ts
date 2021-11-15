/* eslint-disable @typescript-eslint/no-explicit-any */
import config from './config';
import createLink from './createLink';

const { verticalMax, verticalMargin, lineSpacing, leftMarginEnd } = config;

const annotationArrayKey = 'Annots';

const isFirstLineOnSubsequentPage = (pageSize: any, pageIndex: any, idx: any) =>
  pageIndex > 0 && (idx + 1) % pageSize === 0;

const getLinks = (
  objCtx: any,
  parser: any,
  tocText: any[],
  pageIndex: any,
  howManyPages: any,
  pageSize: any
): any[] => {
  let myPage = 0;

  return tocText.reduce((acc, { page }, idx) => {
    const verticalTextStart = verticalMax - verticalMargin;
    const verticalOffset = lineSpacing * (idx % pageSize);
    const verticalLineStart =
      verticalTextStart - (verticalOffset + lineSpacing);
    if (verticalLineStart <= verticalMargin) {
      myPage++;
    }
    // only for page of links (calculated by height) currently being worked on
    if (page && pageIndex === myPage) {
      const vertStart = isFirstLineOnSubsequentPage(pageSize, pageIndex, idx)
        ? verticalTextStart
        : verticalLineStart;
      acc.push(
        createLink(objCtx, parser.getPageObjectID(page + howManyPages - 1), [
          leftMarginEnd,
          vertStart,
          505,
          vertStart + lineSpacing,
        ])
      );
    }

    return acc;
  }, []);
};

export default function writeLinks(
  objCtx: any,
  copyCtx: any,
  parser: any,
  pageIndex: any,
  tocText: any,
  howManyPages: any,
  pageSize: any
) {
  const pageId = parser.getPageObjectID(pageIndex);
  const pageObject = parser.parsePage(pageIndex).getDictionary().toJSObject();

  const links = getLinks(
    objCtx,
    parser,
    tocText,
    pageIndex,
    howManyPages,
    pageSize
  );

  objCtx.startModifiedIndirectObject(pageId);
  const modifiedPageObject = objCtx.startDictionary();

  Object.getOwnPropertyNames(pageObject).forEach((element) => {
    // leave everything besides annotations on TOC pages in tact
    // bookmark annotations are at doc level, so won't be affected
    if (element !== annotationArrayKey) {
      modifiedPageObject.writeKey(element);
      copyCtx.copyDirectObjectAsIs(pageObject[element]);
    }
  });

  modifiedPageObject.writeKey(annotationArrayKey);
  objCtx.startArray();

  links.forEach((link) => objCtx.writeIndirectObjectReference(link));

  objCtx
    .endArray()
    .endLine()
    .endDictionary(modifiedPageObject)
    .endIndirectObject();
}
