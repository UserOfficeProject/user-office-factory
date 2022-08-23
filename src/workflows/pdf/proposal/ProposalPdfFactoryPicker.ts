import { ProposalPDFData } from '../../../types';
import { PdfFactoryPicker } from '../PdfFactory';
import { AutoProposalPdfFactory } from './AutoProposalPdfFactory';
import { CustomProposalPdfFactory } from './CustomProposalPdfFactory';
import { ProposalPDFMeta } from './ProposalPDFMeta';

export class AutoProposalPdfFactoryPicker extends PdfFactoryPicker<
  ProposalPDFData,
  ProposalPDFMeta
> {
  public getFactory(data: ProposalPDFData, entityId: number) {
    const template = data.pdfTemplate?.templateData;
    if (template === undefined) {
      return new AutoProposalPdfFactory(entityId);
    } else {
      return new CustomProposalPdfFactory(entityId, template);
    }
  }
}
