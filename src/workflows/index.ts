import { Readable } from 'stream';

import generateProposalPdf from './proposal';
import generateSamplePdf from './sample';

export default function generatePdf(
  pdfType: string,
  data: any
): Promise<Readable> {
  switch (pdfType) {
    case 'proposal':
      // TODO: check data

      return generateProposalPdf(data);

    case 'sample':
      return generateSamplePdf(data);
    default:
      throw new Error(`Unknown PDF type: ${pdfType}`);
  }
}
