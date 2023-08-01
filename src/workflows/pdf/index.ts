import newProposalPdfWorkflowManager from './proposal';
import newSamplePdfWorkflowManager from './sample';
import newShipmentPdfWorkflowManager from './shipment';
import { Role } from '../../types';

export default function getPDFWorkflowManager(
  pdfType: string,
  { data, userRole }: { data: any[]; userRole: Role }
) {
  // TODO: check data
  switch (pdfType) {
    case 'proposal':
      return newProposalPdfWorkflowManager(data, userRole);
    case 'sample':
      return newSamplePdfWorkflowManager(data, userRole);
    case 'shipment-label':
      return newShipmentPdfWorkflowManager(data, userRole);
    default:
      throw new Error(`Unknown PDF type: ${pdfType}`);
  }
}
