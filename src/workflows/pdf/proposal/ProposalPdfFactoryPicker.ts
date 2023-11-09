import { AutoProposalPdfFactory } from './AutoProposalPdfFactory';
import { CustomProposalPdfFactory } from './CustomProposalPdfFactory';
import { ProposalPDFMeta } from './ProposalPDFMeta';
import { ProposalPDFData, Role } from '../../../types';
import { PdfFactoryPicker } from '../PdfFactory';

/**
 * Picks between custom and auto generate PDF generator based on the
 * proposal's call's PDF template.
 */
export class AutoProposalPdfFactoryPicker extends PdfFactoryPicker<
  ProposalPDFData,
  ProposalPDFMeta
> {
  public getFactory(data: ProposalPDFData, entityId: number, userRole: Role) {
    const templateBody = data.pdfTemplate?.templateData;
    const templateHeader = data.pdfTemplate?.templateHeader;
    const templateFooter = data.pdfTemplate?.templateFooter;
    const templateSampleDeclaration =
      data.pdfTemplate?.templateSampleDeclaration;

    if (templateBody === undefined) {
      return new AutoProposalPdfFactory(entityId, userRole);
    } else {
      return new CustomProposalPdfFactory(
        entityId,
        userRole,
        templateBody,
        templateHeader,
        templateFooter,
        templateSampleDeclaration
      );
    }
  }
}
