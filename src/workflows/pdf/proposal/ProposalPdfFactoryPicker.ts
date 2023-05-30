import { AutoProposalPdfFactory } from './AutoProposalPdfFactory';
import { CustomProposalPdfFactory } from './CustomProposalPdfFactory';
import { ProposalPDFMeta } from './ProposalPDFMeta';
import { ProposalPDFData } from '../../../types';
import { PdfFactoryPicker } from '../PdfFactory';

/**
 * Picks between custom and auto generate PDF generator based on the
 * proposal's call's PDF template.
 */
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
