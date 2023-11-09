import { Readable } from 'stream';

import XLSXWorkflowManager from './XLSXWorkflowManager';
import { ProposalXLSXData, XLSXMetaBase } from '../../types';
import { create } from '../../xlsx';

const generateProposalXLSX =
  ({ data, meta }: { data: ProposalXLSXData[]; meta: XLSXMetaBase }) =>
  async () => {
    const sheetBuffer = create(meta.columns, data);
    const rs = Readable.from(sheetBuffer);

    return rs;
  };

export default function newProposalXLSXWorkflowManager(properties: {
  data: ProposalXLSXData[];
  meta: XLSXMetaBase;
}) {
  return new XLSXWorkflowManager(generateProposalXLSX(properties));
}
