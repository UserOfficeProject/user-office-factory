import { Readable } from 'stream';

import generateProposalPDF from './proposal';
import generateSamplePDF from './sample';

export default function generatePDF(
  pdfType: string,
  { data }: { data: any[] }
): Promise<Readable> {
  switch (pdfType) {
    case 'proposal':
      // TODO: check data

      return generateProposalPDF(data);

    case 'sample':
      return generateSamplePDF(data);
    default:
      throw new Error(`Unknown PDF type: ${pdfType}`);
  }
}
