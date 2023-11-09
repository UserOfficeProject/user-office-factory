import newProposalXLSXWorkflowManager from './proposal';
import newSEPXLSXWorkflowManager from './sep';
import { XLSXMetaBase } from '../../types';

export default function getXLSXWorkflowManager(
  xlsxType: string,
  properties: { data: any[]; meta: XLSXMetaBase }
) {
  switch (xlsxType) {
    case 'proposal':
      return newProposalXLSXWorkflowManager(properties);
    case 'sep':
      return newSEPXLSXWorkflowManager(properties);
    default:
      throw new Error(`Unknown XLSX type: ${xlsxType}`);
  }
}
