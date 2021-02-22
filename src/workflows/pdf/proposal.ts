import { logger } from '@esss-swap/duo-logger';

import { FileMetadata } from '../../models/File';
import { generatePdfFromHtml, TableOfContents } from '../../pdf';
import { renderTemplate, renderHeaderFooter } from '../../template';
import {
  BasicUser,
  Proposal,
  QuestionaryStep,
  ProposalPDFData,
  ProposalSampleData,
  Attachment,
} from '../../types';
import PdfFactory, { PdfFactoryCountedPagesMeta } from './PdfFactory';
import PdfWorkflowManager from './PdfWorkflowManager';

type ProposalPDFMeta = {
  files: {
    proposal: string;
    questionnaires: string[];
    samples: string[];
    attachments: string[];
    technicalReview: string;
  };
  attachmentsFileMeta: FileMetadata[];
  attachments: Attachment[];
};

type ProposalCountedPagesMeta = PdfFactoryCountedPagesMeta<ProposalPDFMeta>;

export class ProposalPdfFactory extends PdfFactory<
  ProposalPDFData,
  ProposalPDFMeta
> {
  protected countedPagesMeta: ProposalCountedPagesMeta;
  protected meta: ProposalPDFMeta = {
    files: {
      proposal: '',
      questionnaires: [],
      samples: [],
      attachments: [],
      technicalReview: '',
    },
    attachmentsFileMeta: [],
    attachments: [],
  };

  static ENTITY_NAME = 'Proposal';

  init(data: ProposalPDFData) {
    const {
      proposal,
      principalInvestigator,
      coProposers,
      questionarySteps,
      technicalReview,
      attachments,
      samples,
    } = data;

    this.countedPagesMeta = {
      proposal: { waitFor: 1, countedPagesPerPdf: {} },
      questionnaires: {
        waitFor: questionarySteps.length > 0 ? 1 : 0,
        countedPagesPerPdf: {},
      },
      technicalReview: {
        waitFor: technicalReview ? 1 : 0,
        countedPagesPerPdf: {},
      },
      samples: { waitFor: samples.length, countedPagesPerPdf: {} },
      attachments: {
        waitFor: 0 /* set by fetched:attachmentsFileMeta */,
        countedPagesPerPdf: {},
      },
    };

    /**
     * Generate task list to track what needs to be done
     */

    const tasksNeeded = ['render:proposal', 'count-pages:proposal'];

    if (questionarySteps.length > 0) {
      tasksNeeded.push('render:questionnaires');
      tasksNeeded.push('count-pages:questionnaires');
    }

    if (technicalReview) {
      tasksNeeded.push('render:technicalReview');
      tasksNeeded.push('count-pages:technicalReview');
    }

    if (attachments.length > 0) {
      tasksNeeded.push('fetch:attachments');
      tasksNeeded.push('fetch:attachmentsFileMeta');
      tasksNeeded.push('count-pages:attachments');
    }

    if (samples.length > 0) {
      tasksNeeded.push('render:samples');
      tasksNeeded.push('count-pages:samples');
    }

    logger.logDebug(this.logPrefix + 'tasks needed to complete', tasksNeeded);

    /**
     * Listeners
     */

    this.on('countPages', this.countPages);

    this.once('render:proposal', this.renderProposal);
    this.once('render:questionnaires', this.renderQuestionarySteps);
    this.once('render:technicalReview', this.renderTechnicalReview);
    this.once('render:samples', this.renderSamples);
    this.once('fetch:attachments', this.fetchAttachments);
    this.once(
      'fetch:attachmentsFileMeta',
      this.fetchAttachmentsFileMeta(['application/pdf', '^image/.*'])
    );

    this.once('rendered:proposal', pdfPath => {
      this.meta.files.proposal = pdfPath;
      this.emit('taskFinished', 'render:proposal');
    });

    this.once('rendered:technicalReview', pdfPath => {
      this.meta.files.technicalReview = pdfPath;
      this.emit('taskFinished', 'render:technicalReview');
    });

    this.on('rendered:questionary', pdfPath => {
      this.meta.files.questionnaires.push(pdfPath);

      this.emit('taskFinished', 'render:questionnaires');
    });

    this.on('rendered:sample', pdfPath => {
      this.meta.files.samples.push(pdfPath);

      if (this.meta.files.samples.length === samples.length) {
        this.emit('taskFinished', 'render:samples');
      }
    });

    this.on('fetched:attachment', attachmentPath => {
      this.meta.files.attachments.push(attachmentPath);

      if (
        this.meta.files.attachments.length ===
        this.meta.attachmentsFileMeta.length
      ) {
        this.emit('taskFinished', 'fetch:attachments');
      }
    });

    this.once(
      'fetched:attachmentsFileMeta',
      (attachmentsFileMeta, attachments) => {
        this.meta.attachmentsFileMeta = attachmentsFileMeta;
        this.countedPagesMeta.attachments.waitFor = attachmentsFileMeta.length;

        this.emit('taskFinished', 'fetch:attachmentsFileMeta');

        if (questionarySteps.length > 0) {
          this.emit(
            'render:questionnaires',
            questionarySteps,
            attachmentsFileMeta
          );
        }

        if (samples.length > 0) {
          this.emit('render:samples', samples, attachmentsFileMeta);
        }

        if (this.countedPagesMeta.attachments.waitFor === 0) {
          this.emit('taskFinished', 'fetch:attachments');
          this.emit('taskFinished', 'count-pages:attachments');
        } else {
          this.emit('fetch:attachments', attachmentsFileMeta, attachments);
        }
      }
    );

    this.on('taskFinished', task => {
      logger.logDebug(this.logPrefix + 'task finished', { task });
      tasksNeeded.splice(tasksNeeded.indexOf(task), 1);

      if (tasksNeeded.length === 0 && !this.stopped) {
        logger.logDebug(this.logPrefix + 'every task finished', { task });
        this.emit('done', this.meta, this.countedPagesMeta);
      }
    });

    /**
     * Emitters
     */

    this.emit('render:proposal', proposal, principalInvestigator, coProposers);

    if (technicalReview) {
      this.emit('render:technicalReview', technicalReview);
    }

    if (attachments.length > 0) {
      this.meta.attachments = attachments;
      this.emit('fetch:attachmentsFileMeta', attachments);
    } else {
      if (questionarySteps.length > 0) {
        this.emit('render:questionnaires', questionarySteps, []);
      }

      if (samples.length > 0) {
        this.emit('render:samples', samples, []);
      }
    }
  }

  private async renderProposal(
    proposal: Proposal,
    principalInvestigator: BasicUser,
    coProposers: BasicUser[]
  ) {
    if (this.stopped) {
      this.emit('aborted', 'renderProposal');

      return;
    }

    try {
      const renderedProposalHtml = await renderTemplate('proposal-main.hbs', {
        proposal,
        principalInvestigator,
        coProposers,
      });
      const renderedHeaderFooter = await renderHeaderFooter();

      const pdfPath = await generatePdfFromHtml(renderedProposalHtml, {
        pdfOptions: renderedHeaderFooter,
      });

      this.emit('countPages', pdfPath, 'proposal');
      this.emit('rendered:proposal', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderProposal');
    }
  }

  private async renderQuestionarySteps(
    questionarySteps: QuestionaryStep[],
    attachmentsFileMeta: FileMetadata[]
  ) {
    if (this.stopped) {
      this.emit('aborted', 'renderQuestionarySteps');

      return;
    }

    try {
      const renderedProposalQuestion = await renderTemplate(
        'questionary-step.hbs',
        { steps: questionarySteps, attachmentsFileMeta }
      );
      const renderedHeaderFooter = await renderHeaderFooter();

      const pdfPath = await generatePdfFromHtml(renderedProposalQuestion, {
        pdfOptions: renderedHeaderFooter,
      });

      this.emit('countPages', pdfPath, 'questionnaires');
      this.emit('rendered:questionary', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderQuestionarySteps');
    }
  }

  private async renderTechnicalReview(technicalReview: {
    status: string;
    timeAllocation: number;
    publicComment: string;
  }) {
    if (this.stopped) {
      this.emit('aborted', 'renderTechnicalReview');

      return;
    }

    try {
      const renderedTechnicalReview = await renderTemplate(
        'technical-review.hbs',
        { technicalReview }
      );
      const renderedHeaderFooter = await renderHeaderFooter();

      const pdfPath = await generatePdfFromHtml(renderedTechnicalReview, {
        pdfOptions: renderedHeaderFooter,
      });

      this.emit('countPages', pdfPath, 'technicalReview');
      this.emit('rendered:technicalReview', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderTechnicalReview');
    }
  }

  private async renderSamples(
    samples: ProposalSampleData[],
    attachmentsFileMeta: FileMetadata[]
  ) {
    try {
      for (const { sample, sampleQuestionaryFields } of samples) {
        if (this.stopped) {
          this.emit('aborted', 'renderSamples');

          return;
        }

        const renderedProposalSample = await renderTemplate('sample.hbs', {
          sample,
          sampleQuestionaryFields,
          attachmentsFileMeta,
        });
        const renderedHeaderFooter = await renderHeaderFooter();

        const pdfPath = await generatePdfFromHtml(renderedProposalSample, {
          pdfOptions: renderedHeaderFooter,
        });

        this.emit('countPages', pdfPath, 'samples');
        this.emit('rendered:sample', pdfPath);
      }
    } catch (e) {
      this.emit('error', e, 'renderSamples');
    }
  }
}

export default function newProposalPdfWorkflowManager(data: ProposalPDFData[]) {
  const manager = new PdfWorkflowManager<
    ProposalPDFData,
    ProposalPDFMeta,
    ProposalPdfFactory
  >(ProposalPdfFactory, data, data => data.proposal.id);

  manager.onFinalizePDF(
    ({ data, filePaths, meta, metaCountedPages, pageNumber, rootToC }) => {
      const toc: TableOfContents = {
        title: `Proposal number: ${data.proposal.shortCode}`,
        page: pageNumber,
        children: [],
      };

      pageNumber +=
        metaCountedPages.proposal.countedPagesPerPdf[meta.files.proposal];

      filePaths.push(meta.files.proposal);

      meta.files.questionnaires.forEach(questionary => {
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
