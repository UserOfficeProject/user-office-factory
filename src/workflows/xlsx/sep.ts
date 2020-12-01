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
  const wb = newWorkBook();

  // handle edge case (no data)
  if (data.length === 0) {
    appendSheet(wb, 'Sheet 1', [], []);
  }

  for (const { sheetName, rows } of data) {
    appendSheet(wb, sheetName, meta.columns, rows);
  }

  const sheetBuffer = finalizeAndCreate(wb);
  const rs = Readable.from(sheetBuffer);

  return rs;
}
