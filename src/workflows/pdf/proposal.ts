import PdfWorkflowManager from './PdfWorkflowManager';
import { AutoProposalPdfFactoryPicker } from './proposal/ProposalPdfFactoryPicker';
import { ProposalPDFMeta } from './proposal/ProposalPDFMeta';
import { TableOfContents } from '../../pdf';
import { ProposalPDFData } from '../../types';

export default function newProposalPdfWorkflowManager(data: ProposalPDFData[]) {
  const manager = new PdfWorkflowManager<ProposalPDFData, ProposalPDFMeta>(
    new AutoProposalPdfFactoryPicker(),
    data,
    (data) => data.proposal.primaryKey
  );

  manager.onFinalizePDF(
    ({ data, filePaths, meta, metaCountedPages, pageNumber, rootToC }) => {
      const toc: TableOfContents = {
        title: `Proposal number: ${data.proposal.proposalId}`,
        page: pageNumber,
        children: [],
      };

      pageNumber +=
        metaCountedPages.proposal.countedPagesPerPdf[meta.files.proposal];

      filePaths.push(meta.files.proposal);

      meta.files.questionnaires.forEach((questionary) => {
        filePaths.push(questionary);
        toc.children.push({
          title: 'Questionary', // data.questionarySteps[qIdx].topic.title,
          page: pageNumber,
          children: [],
        });

        pageNumber +=
          metaCountedPages.questionnaires.countedPagesPerPdf[questionary];
      });

      if (meta.files.samples.length > 0) {
        const sampleToC: TableOfContents = {
          title: 'Samples',
          page: pageNumber,
          children: [],
        };

        meta.files.samples.forEach((sample, qIdx) => {
          filePaths.push(sample);
          sampleToC.children.push({
            title: `Sample: ${data.samples[qIdx].sample.title}`,
            page: pageNumber,
            children: [],
          });

          pageNumber += metaCountedPages.samples.countedPagesPerPdf[sample];
        });

        toc.children.push(sampleToC);
      }

      if (meta.files.attachments.length > 0) {
        const attachmentToC: TableOfContents = {
          title: 'Attachments',
          page: pageNumber,
          children: [],
        };

        meta.files.attachments.forEach((attachment, aIdx) => {
          const attachmentFileMeta = meta.attachmentsFileMeta[aIdx];
          const attachmentMeta = meta.attachments.find(
            ({ id }) => id === attachmentFileMeta.fileId
          );

          filePaths.push(attachment);
          attachmentToC.children.push({
            title:
              attachmentMeta && attachmentMeta.figure
                ? `Figure ${attachmentMeta.figure}`
                : attachmentFileMeta.originalFileName,
            page: pageNumber,
            children: [],
          });

          pageNumber +=
            metaCountedPages.attachments.countedPagesPerPdf[attachment];
        });

        toc.children.push(attachmentToC);
      }

      if (meta.files.technicalReview) {
        filePaths.push(meta.files.technicalReview.toString());
        toc.children.push({
          title: 'Technical Review',
          page: pageNumber,
          children: [],
        });

        pageNumber +=
          metaCountedPages.technicalReview.countedPagesPerPdf[
            meta.files.technicalReview.toString()
          ];
      }

      rootToC.push(toc);

      return pageNumber;
    }
  );

  manager.start();

  return manager;
}
