import newAttachmentZIPWorkflowManager from './attachment';
import { Role } from '../../types';
import newProposalPdfWorkflowManager from '../pdf/proposal';

export default function getZIPWorkflowManager(
  zipType: string,
  { data, userRole }: { data: any[]; userRole: Role }
) {
  switch (zipType) {
    case 'attachment':
      return newAttachmentZIPWorkflowManager(data);
    case 'proposal':
      return newProposalPdfWorkflowManager(data, userRole, true);

    default:
      throw new Error(`Unknown PDF type: ${zipType}`);
  }
}
