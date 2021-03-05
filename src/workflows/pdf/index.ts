import newProposalPdfWorkflowManager from './proposal';
import newSamplePdfWorkflowManager from './sample';
import newShipmentPdfWorkflowManager from './shipment';

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
    case 'shipment-label':
      return newShipmentPdfWorkflowManager(data);
    default:
      throw new Error(`Unknown PDF type: ${pdfType}`);
  }
}
