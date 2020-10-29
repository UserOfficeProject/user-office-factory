import { Readable } from 'stream';

import generateProposalPdf from './proposal';

export default function generatePdf(
  pdfType: string,
  data: any
): Promise<Readable> {
  switch (pdfType) {
    case 'proposal':
      // TODO: check data

      return generateProposalPdf(data);
    default:
      throw new Error('Unknown');
  }
}
