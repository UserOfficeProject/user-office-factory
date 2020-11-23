import { Readable } from 'stream';

import { ProposalXLSXData, XLSXMetaBase } from '../../types';
import { create } from '../../xlsx';

export default async function generateProposalXLSX({
  data,
  meta,
}: {
  data: ProposalXLSXData[];
  meta: XLSXMetaBase;
}) {
  const sheetBuffer = create(meta.columns, data);
  const rs = Readable.from(sheetBuffer);

  return rs;
}
