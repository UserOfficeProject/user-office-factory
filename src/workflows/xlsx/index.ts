import { Readable } from 'stream';

import { XLSXMetaBase } from '../../types';
import generateProposalXLSX from './proposal';

export default function generateXLSX(
  xlsxType: string,
  properties: { data: any[]; meta: XLSXMetaBase }
): Promise<Readable> {
  switch (xlsxType) {
    case 'proposal':
      return generateProposalXLSX(properties);
    default:
      throw new Error(`Unknown XLSX type: ${xlsxType}`);
  }
}
