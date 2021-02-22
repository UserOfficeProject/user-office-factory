import newProposalPdfWorkflowManager from './proposal';
import newSamplePdfWorkflowManager from './sample';

export default function getPDFWorkflowManager(
  pdfType: string,
  { data }: { data: any[] }
) {
  // TODO: check data
  switch (pdfType) {
    case 'proposal':
      return newProposalPdfWorkflowManager(data);
    case 'sample':
      return newSamplePdfWorkflowManager(data);
    default:
      throw new Error(`Unknown PDF type: ${pdfType}`);
  }
}
