import newFapXLSXWorkflowManager from './fap';
import newProposalXLSXWorkflowManager from './proposal';
import { XLSXMetaBase } from '../../types';

export default function getXLSXWorkflowManager(
  xlsxType: string,
  properties: { data: any[]; meta: XLSXMetaBase }
) {
  switch (xlsxType) {
    case 'proposal':
      return newProposalXLSXWorkflowManager(properties);
    case 'fap':
      return newFapXLSXWorkflowManager(properties);
    default:
      throw new Error(`Unknown XLSX type: ${xlsxType}`);
  }
}
