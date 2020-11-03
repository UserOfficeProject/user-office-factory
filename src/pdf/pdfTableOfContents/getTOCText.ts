/* eslint-disable @typescript-eslint/no-explicit-any */
export default function getTOCText(outline: any, tocPageCount: any) {
  const getTabs = (tabLevel: any) => {
    let output = '';
    for (let i = 0; i < tabLevel; ++i) {
      output += '  ';
    }

    return output;
  };
  const lineLength = 60;
  const makeTOC = (outln: any, tabLevel: any, prefix = '') =>
    outln.reduce((acc: any, curr: any, idx: any) => {
      const entry = `${getTabs(tabLevel)}${prefix}${idx + 1} ${curr.title}`;
      const paddingLength =
        lineLength - String(curr.page + tocPageCount).length;
      const line = curr.page
        ? `${entry.padEnd(paddingLength, '.')}${curr.page + tocPageCount}`
        : entry;
      if (curr.children) {
        acc.push({ line, page: curr.page });
        const merged = acc.concat(
          makeTOC(curr.children, ++tabLevel, `${prefix}${idx + 1}.`)
        );
        tabLevel--;

        return merged;
      }
      acc.push({ line, page: curr.page });

      return acc;
    }, []);

  return makeTOC(outline, 0);
}
