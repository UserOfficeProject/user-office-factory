import { Readable } from 'stream';

import { SEPXLSXData, XLSXMetaBase } from '../../types';
import { newWorkBook, appendSheet, finalizeAndCreate } from '../../xlsx';

export default async function generateProposalXLSX({
  data,
  meta,
}: {
  data: SEPXLSXData;
  meta: XLSXMetaBase;
}) {
  console.dir(data, { depth: 10 });

  const wb = newWorkBook();

  for (const { sheetName, rows } of data) {
    appendSheet(wb, sheetName, meta.columns, rows);
  }

  const sheetBuffer = finalizeAndCreate(wb);
  const rs = Readable.from(sheetBuffer);

  return rs;
}
