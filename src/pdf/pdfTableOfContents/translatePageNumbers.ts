/* eslint-disable @typescript-eslint/no-explicit-any */
export default function translatePageNumbers(
  parser: any,
  outline: any,
  offset = 0
) {
  return outline.children
    ? {
        ...outline,
        page:
          outline.page || outline.page === 0
            ? parser.getPageObjectID(outline.page + offset - 1)
            : undefined,
        children: outline.children.map((childOutline: any) =>
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
