import { PdfFactoryCountedPagesMeta } from './PdfFactory';
import PdfWorkflowManager from './PdfWorkflowManager';
import { AutoProposalPdfFactoryPicker } from './proposal/ProposalPdfFactoryPicker';
import {
  FullProposalPDFMeta,
  PregeneratedProposalPDFMeta,
  ProposalPDFMeta,
} from './proposal/ProposalPDFMeta';
import { TableOfContents } from '../../pdf';
import { FullProposalPDFData, ProposalPDFData, Role } from '../../types';

export default function newProposalPdfWorkflowManager(
  data: ProposalPDFData[],
  userRole: Role,
  zipDownload?: boolean
) {
  const manager = new PdfWorkflowManager<ProposalPDFData, ProposalPDFMeta>(
    new AutoProposalPdfFactoryPicker(),
    data,
    (data) => data.proposal.primaryKey,
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
      if (meta.type === 'pregenerated') {
        const pregeneratedMetaCountedPages =
          metaCountedPages as PdfFactoryCountedPagesMeta<PregeneratedProposalPDFMeta>;

        filePaths.push(meta.files.proposal);
        const tocEntry: TableOfContents = {
          title: `Proposal number: ${data.proposal.proposalId}`,
          page: pageNumber,
          children: [],
        };
        rootToC.push(tocEntry);

        pageNumber +=
          pregeneratedMetaCountedPages.proposal.countedPagesPerPdf[
            meta.files.proposal
          ];

        return pageNumber;
      } else if (meta.type === 'full') {
        const fullMetaCountedPages =
          metaCountedPages as PdfFactoryCountedPagesMeta<FullProposalPDFMeta>;
        const fullProposalPdfData = data as FullProposalPDFData;

        const toc: TableOfContents = {
          title: `Proposal number: ${data.proposal.proposalId}`,
          page: pageNumber,
          children: stepUpToc(meta.toc.proposal, pageNumber) || [],
        };

        pageNumber +=
          fullMetaCountedPages.proposal.countedPagesPerPdf[meta.files.proposal];

        filePaths.push(meta.files.proposal);

        meta.files.questionnaires.forEach((questionary, index) => {
          filePaths.push(questionary);
          toc.children.push({
            title: 'Questionary', // data.questionarySteps[qIdx].topic.title,
            page: pageNumber,
            children: stepUpToc(meta.toc.questionnaires[index], pageNumber),
          });

          pageNumber +=
            fullMetaCountedPages.questionnaires.countedPagesPerPdf[questionary];
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
              title: `Sample: ${fullProposalPdfData.samples[qIdx].sample.title}`,
              page: pageNumber,
              children: stepUpToc(meta.toc.samples[qIdx], pageNumber),
            });

            pageNumber +=
              fullMetaCountedPages.samples.countedPagesPerPdf[sample];
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
              fullMetaCountedPages.attachments.countedPagesPerPdf[attachment];
          });

          toc.children.push(attachmentToC);
        }

        if (meta.files.technicalReview) {
          filePaths.push(meta.files.technicalReview.toString());
          toc.children.push({
            title: 'Technical Review',
            page: pageNumber,
            children: stepUpToc(meta.toc.technicalReview, pageNumber),
          });

          pageNumber +=
            fullMetaCountedPages.technicalReview.countedPagesPerPdf[
              meta.files.technicalReview.toString()
            ];
        }

        rootToC.push(toc);

        return pageNumber;
      }

      throw new Error(`Unhandled meta type: ${meta}`);
    }
  );

  manager.onFinalizeFileName(({ data }) => {
    return `${data.proposal.proposalId}_${
      data.principalInvestigator.lastname
    }_${new Date(data.proposal.created).getUTCFullYear()}.pdf`;
  });

  manager.onFinalizeDownloadType(() => {
    return zipDownload !== undefined ? zipDownload : false;
  });

  manager.start();

  return manager;
}
