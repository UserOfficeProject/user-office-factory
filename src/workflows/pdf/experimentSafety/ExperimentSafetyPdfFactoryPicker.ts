import { AutoExperimentSafetyPdfFactory } from './AutoExperimentSafetyPdfFactory';
import { CustomExperimentSafetyPdfFactory } from './CustomExperimentSafetyPdfFactory';
import { ExperimentSafetyPDFMeta } from './ExperimentSafetyPDFMeta';
import { ExperimentSafetyPDFData, Role } from '../../../types';
import { PdfFactoryPicker } from '../PdfFactory';

/**
 * Picks between custom and auto generate PDF generator based on the
 * proposal's call's PDF template.
 */
export class AutoExperimentSafetyPdfFactoryPicker extends PdfFactoryPicker<
  ExperimentSafetyPDFData,
  ExperimentSafetyPDFMeta
> {
  public getFactory(
    data: ExperimentSafetyPDFData,
    entityId: number,
    userRole: Role
  ) {
    const templateBody = data.pdfTemplate?.templateData;
    const templateHeader = data.pdfTemplate?.templateHeader;
    const templateFooter = data.pdfTemplate?.templateFooter;
    if (templateBody === undefined) {
      return new AutoExperimentSafetyPdfFactory(entityId, userRole);
    } else {
      return new CustomExperimentSafetyPdfFactory(
        entityId,
        userRole,
        templateBody,
        templateHeader,
        templateFooter
      );
    }
  }
}
