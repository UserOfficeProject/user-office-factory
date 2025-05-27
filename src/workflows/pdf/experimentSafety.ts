import { AutoExperimentSafetyPdfFactoryPicker } from './experimentSafety/ExperimentSafetyPdfFactoryPicker';
import { ExperimentSafetyPDFMeta } from './experimentSafety/ExperimentSafetyPDFMeta';
import PdfWorkflowManager from './PdfWorkflowManager';
import { TableOfContents } from '../../pdf';
import { ExperimentSafetyPDFData, Role } from '../../types';

export default function newExperimentSafetyPdfWorkflowManager(
  data: ExperimentSafetyPDFData[],
  userRole: Role,
  zipDownload?: boolean
) {
  const manager = new PdfWorkflowManager<
    ExperimentSafetyPDFData,
    ExperimentSafetyPDFMeta
  >(
    new AutoExperimentSafetyPdfFactoryPicker(),
    data,
    (data) => data.experiment.experimentPk,
    userRole
  );
  //Increase the page number by the step.
  function stepUpToc(toc: TableOfContents[], step: number): TableOfContents[] {
    if (!toc) {
      return [];
    }

    return toc.map((t) => ({
      ...t,
      page: t.page != undefined ? t.page + step : undefined,
      children: stepUpToc(t.children, step),
    }));
  }

  manager.onFinalizePDF(
    ({ data, filePaths, meta, metaCountedPages, pageNumber, rootToC }) => {
      const toc: TableOfContents = {
        title: `Proposal number: ${data.proposal.proposalId}`,
        page: pageNumber,
        children: stepUpToc(meta.toc.experimentSafety, pageNumber) || [],
      };
      pageNumber +=
        metaCountedPages.experimentSafety.countedPagesPerPdf[
          meta.files.experimentSafety
        ];
      filePaths.push(meta.files.experimentSafety);
      rootToC.push(toc);

      return pageNumber;
    }
  );

  manager.onFinalizeFileName(({ data }) => {
    return `ESD_${data.experiment.experimentId}_${new Date(data.proposal.created).getUTCFullYear()}.pdf`;
  });

  manager.onFinalizeDownloadType(() => {
    return zipDownload !== undefined ? zipDownload : false;
  });

  manager.start();

  return manager;
}
