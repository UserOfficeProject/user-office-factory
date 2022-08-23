import { ProposalPDFData } from '../../../types';
import { PdfFactoryPicker } from '../PdfFactory';
import { AutoProposalPdfFactory } from './AutoProposalPdfFactory';
import { ProposalPDFMeta } from './ProposalPDFMeta';

export class AutoProposalPdfFactoryPicker extends PdfFactoryPicker<
  ProposalPDFData,
  ProposalPDFMeta
> {
  public getFactory(data: ProposalPDFData, entityId: number) {
    return new AutoProposalPdfFactory(entityId);
  }
}
