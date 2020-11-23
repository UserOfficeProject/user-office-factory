import { Readable } from 'stream';

import { XLSXMetaBase } from '../../types';
import generateProposalXLSX from './proposal';
import generateSEPXLSX from './sep';

export default function generateXLSX(
  xlsxType: string,
  properties: { data: any[]; meta: XLSXMetaBase }
): Promise<Readable> {
  switch (xlsxType) {
    case 'proposal':
      return generateProposalXLSX(properties);
    case 'sep':
      return generateSEPXLSX(properties);
    default:
      throw new Error(`Unknown XLSX type: ${xlsxType}`);
  }
}
