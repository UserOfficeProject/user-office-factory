import { Readable } from 'stream';

import { ProposalXLSXData, XLSXMetaBase } from '../../types';
import { writeToSheet } from '../../xlsx';

export default async function generateProposalXLSX({
  data,
  meta,
}: {
  data: ProposalXLSXData[];
  meta: XLSXMetaBase;
}) {
  const sheetBuffer = writeToSheet(meta.columns, data);
  const rs = Readable.from(sheetBuffer);

  return rs;
}
