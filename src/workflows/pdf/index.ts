import { Readable } from 'stream';

import PdfWorkflowManager from './PdfFactoryManager';
import generateProposalPDF, { ProposalPdfEmitter } from './proposal';
import generateSamplePDF, { SamplePdfEmitter } from './sample';

export default function generatePDF(
  pdfType: string,
  { data }: { data: any[] }
) {
  switch (pdfType) {
    case 'proposal':
      // TODO: check data

      return new PdfWorkflowManager(ProposalPdfEmitter, data);
    case 'sample':
      return new PdfWorkflowManager(SamplePdfEmitter, data);
    default:
      throw new Error(`Unknown PDF type: ${pdfType}`);
  }
}
