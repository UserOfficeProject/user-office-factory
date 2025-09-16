import { logger } from '@user-office-software/duo-logger';

import { FullProposalPDFMeta } from './ProposalPDFMeta';
import { FileMetadata } from '../../../models/File';
import { generatePdfFromHtml } from '../../../pdf';
import { renderTemplate, renderHeaderFooter } from '../../../template';
import {
  BasicUser,
  Proposal,
  QuestionaryStep,
  ProposalSampleData,
  GenericTemplate,
  FullProposalPDFData,
} from '../../../types';
import PdfFactory, { PdfFactoryCountedPagesMeta } from '../PdfFactory';

export class AutoProposalPdfFactory extends PdfFactory<
  FullProposalPDFData,
  FullProposalPDFMeta
> {
  protected countedPagesMeta: PdfFactoryCountedPagesMeta<FullProposalPDFMeta>;
  protected meta: FullProposalPDFMeta = {
    files: {
      proposal: '',
      questionnaires: [],
      samples: [],
      genericTemplates: [],
      attachments: [],
      technicalReview: '',
    },
    toc: {
      proposal: [],
      questionnaires: [],
      samples: [],
      genericTemplates: [],
      attachments: [],
      technicalReview: [],
    },
    attachmentsFileMeta: [],
    attachments: [],
    isPregeneratedPdfMeta: false,
  };

  static ENTITY_NAME = 'Proposal';

  init(data: FullProposalPDFData) {
    const {
      proposal,
      principalInvestigator,
      coProposers,
      questionarySteps,
      technicalReviews,
      attachments,
      samples,
      genericTemplates,
    } = data;

    this.countedPagesMeta = {
      proposal: { waitFor: 1, countedPagesPerPdf: {} },
      questionnaires: {
        waitFor: questionarySteps.length > 0 ? 1 : 0,
        countedPagesPerPdf: {},
      },
      technicalReview: {
        waitFor: technicalReviews.length ? 1 : 0,
        countedPagesPerPdf: {},
      },
      samples: { waitFor: samples.length, countedPagesPerPdf: {} },
      genericTemplates: {
        waitFor: genericTemplates.length,
        countedPagesPerPdf: {},
      },
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

    if (technicalReviews.length > 0) {
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

    logger.logDebug(this.logPrefix + 'tasks needed to complete', {
      info: JSON.stringify(tasksNeeded),
    });

    /**
     * Listeners
     */
    this.on('countPages', this.countPages);
    logger.logDebug(`${this.logPrefix} countPages completed`, {});
    this.once('render:proposal', this.renderProposal);

    logger.logDebug(`${this.logPrefix} render:proposal completed`, {});
    this.once('render:questionnaires', this.renderQuestionarySteps);
    logger.logDebug(`${this.logPrefix} render:questionnaires completed`, {});
    this.once('render:technicalReview', this.renderTechnicalReview);
    logger.logDebug(`${this.logPrefix} render:technicalReview completed`, {});
    this.once('render:samples', this.renderSamples);
    logger.logDebug(`${this.logPrefix} render:samples completed`, {});
    this.once('fetch:attachments', this.fetchAttachments);
    logger.logDebug(`${this.logPrefix} fetch:attachments completed`, {});
    this.once(
      'fetch:attachmentsFileMeta',
      this.fetchAttachmentsFileMeta(['application/pdf', '^image/.*'])
    );
    logger.logDebug(
      `${this.logPrefix} fetch:attachmentsFileMeta completed`,
      {}
    );
    this.once('rendered:proposal', (pdf) => {
      this.meta.files.proposal = pdf.pdfPath;
      this.meta.toc.proposal = pdf.toc;
      this.emit('taskFinished', 'render:proposal');
    });
    logger.logDebug(`${this.logPrefix} render:proposal completed`, {});
    this.once('rendered:technicalReview', (pdf) => {
      this.meta.files.technicalReview = pdf.pdfPath;
      this.meta.toc.technicalReview = pdf.toc;

      this.emit('taskFinished', 'render:technicalReview');
    });

    this.on('rendered:questionary', (pdf) => {
      this.meta.files.questionnaires.push(pdf.pdfPath);
      this.meta.toc.questionnaires.push(pdf.toc);

      this.emit('taskFinished', 'render:questionnaires');
    });

    this.on('rendered:sample', (pdf) => {
      this.meta.files.samples.push(pdf.pdfPath);
      this.meta.toc.samples.push(pdf.toc);

      if (this.meta.files.samples.length === samples.length) {
        this.emit('taskFinished', 'render:samples');
      }
    });

    this.on('fetched:attachment', (attachmentPath) => {
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
            proposal,
            questionarySteps,
            genericTemplates,
            attachmentsFileMeta
          );
        }

        if (samples.length > 0) {
          this.emit('render:samples', proposal, samples, attachmentsFileMeta);
        }

        if (this.countedPagesMeta.attachments.waitFor === 0) {
          this.emit('taskFinished', 'fetch:attachments');
          this.emit('taskFinished', 'count-pages:attachments');
        } else {
          this.emit('fetch:attachments', attachmentsFileMeta, attachments);
        }
      }
    );

    this.on('taskFinished', (task) => {
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

    if (technicalReviews.length) {
      this.emit('render:technicalReview', proposal, technicalReviews);
    }

    if (attachments.length > 0) {
      this.meta.attachments = attachments;
      this.emit('fetch:attachmentsFileMeta', attachments);
    } else {
      if (questionarySteps.length > 0) {
        this.emit(
          'render:questionnaires',
          proposal,
          questionarySteps,
          genericTemplates,
          []
        );
      }

      if (samples.length > 0) {
        this.emit('render:samples', proposal, samples, []);
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
      })
        .catch((e) => {
          this.emit('error', e, 'renderedProposalHtml');

          return e;
        })
        .finally(() => {
          logger.logDebug(
            `${this.logPrefix} renderedProposalHtml successful`,
            {}
          );
        });
      const renderedHeaderFooter = await renderHeaderFooter(proposal.proposalId)
        .catch((e) => {
          this.emit('error', e, 'renderedHeaderFooter');

          return e;
        })
        .finally(() => {
          logger.logDebug(
            `${this.logPrefix} renderedHeaderFooter successful`,
            {}
          );
        });

      const pdf = await generatePdfFromHtml(renderedProposalHtml, {
        pdfOptions: renderedHeaderFooter,
      })
        .catch((e) => {
          this.emit('error', e, 'generatePdfFromHtml');

          return e;
        })
        .finally(() => {
          logger.logDebug(
            `${this.logPrefix} generatePdfFromHtml successful`,
            {}
          );
        });

      this.emit('countPages', pdf.pdfPath, 'proposal');
      this.emit('rendered:proposal', pdf);
    } catch (e) {
      this.emit('error', e, 'renderProposal');
    }
  }

  private async renderQuestionarySteps(
    proposal: Proposal,
    questionarySteps: QuestionaryStep[],
    genericTemplates: GenericTemplate[],
    attachmentsFileMeta: FileMetadata[]
  ) {
    if (this.stopped) {
      this.emit('aborted', 'renderQuestionarySteps');

      return;
    }

    try {
      const [renderedProposalQuestion, renderedHeaderFooter] =
        await Promise.all([
          renderTemplate('questionary-step.hbs', {
            steps: questionarySteps,
            genericTemplates,
            attachmentsFileMeta,
          }),
          renderHeaderFooter(proposal.proposalId),
        ]);

      const pdf = await generatePdfFromHtml(renderedProposalQuestion, {
        pdfOptions: renderedHeaderFooter,
      });

      this.emit('countPages', pdf.pdfPath, 'questionnaires');
      this.emit('rendered:questionary', pdf);
    } catch (e) {
      this.emit('error', e, 'renderQuestionarySteps');
    }
  }

  private async renderTechnicalReview(
    proposal: Proposal,
    technicalReviews: {
      status: string;
      timeAllocation: number;
      publicComment: string;
      instrumentName: string;
    }[]
  ) {
    if (this.stopped) {
      this.emit('aborted', 'renderTechnicalReview');

      return;
    }

    try {
      const [renderedTechnicalReview, renderedHeaderFooter] = await Promise.all(
        [
          renderTemplate('technical-review.hbs', { technicalReviews }),
          renderHeaderFooter(proposal.proposalId),
        ]
      );

      const pdf = await generatePdfFromHtml(renderedTechnicalReview, {
        pdfOptions: renderedHeaderFooter,
      });

      this.emit('countPages', pdf.pdfPath, 'technicalReview');
      this.emit('rendered:technicalReview', pdf);
    } catch (e) {
      this.emit('error', e, 'renderTechnicalReview');
    }
  }

  private async renderSamples(
    proposal: Proposal,
    samples: ProposalSampleData[],
    attachmentsFileMeta: FileMetadata[]
  ) {
    try {
      for (const { sample, sampleQuestionaryFields } of samples) {
        if (this.stopped) {
          this.emit('aborted', 'renderSamples');

          return;
        }

        const [renderedProposalSample, renderedHeaderFooter] =
          await Promise.all([
            renderTemplate('sample.hbs', {
              sample,
              sampleQuestionaryFields,
              attachmentsFileMeta,
            }),
            renderHeaderFooter(proposal.proposalId),
          ]);

        const pdf = await generatePdfFromHtml(renderedProposalSample, {
          pdfOptions: renderedHeaderFooter,
        });

        this.emit('countPages', pdf.pdfPath, 'samples');
        this.emit('rendered:sample', pdf);
      }
    } catch (e) {
      this.emit('error', e, 'renderSamples');
    }
  }
}
