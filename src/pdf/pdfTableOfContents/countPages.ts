/* eslint-disable @typescript-eslint/no-explicit-any */
import config from './config';

const { verticalMax, verticalMargin, lineSpacing } = config;

export default function countPages(itemCount: any) {
  const verticalTextStart = verticalMax - verticalMargin;

  let pageSize = 0;
  let pages = 1;

  for (let i = 0; i < itemCount; i++) {
    const pageIndex = pageSize ? i % pageSize : i;
    const verticalOffset = lineSpacing * (pageIndex + 1);
    const verticalLineStart = verticalTextStart - verticalOffset;
    if (verticalLineStart <= verticalMargin) {
      pages++;
      if (!pageSize) {
        pageSize = i + 1;
      }
    }
  }

  return pages;
}
