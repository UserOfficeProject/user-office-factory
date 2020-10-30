// eslint-disable-next-line @typescript-eslint/ban-ts-ignore
// @ts-ignore
import hummus from 'hummus';
import * as _ from 'lodash';

import extractText from './lib/text-extraction';

export default function extractPDFText(fileToRun: string) {
  const pdfReader = hummus.createReader(fileToRun);

  const pagesPlacements: Array<Array<{
    text: string;
    globalBBox: [number, number, number, number];
  }>> = extractText(pdfReader);

  const lines: string[][] = [];
  let x = pagesPlacements[0][0].globalBBox[1];
  let buffer: string[] = [];
  for (let i = 0; i < pagesPlacements.length; ++i) {
    pagesPlacements[i].forEach(placement => {
      if (placement.globalBBox[1] !== x) {
        lines.push(buffer);
        buffer = [];
        x = placement.globalBBox[1];
      }

      buffer.push(placement.text);
    });
  }

  let mergedLines = '';

  for (const line of lines) {
    mergedLines += '\n' + line.join('').trim();
  }

  return mergedLines;
}
