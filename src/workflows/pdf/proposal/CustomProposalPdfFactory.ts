import { logger } from '@user-office-software/duo-logger';

import { ProposalPDFMeta, ProposalCountedPagesMeta } from './ProposalPDFMeta';
import { extractAnswerMap } from './QuestionAnswerMapper';
import { generatePdfFromHtml } from '../../../pdf';
import { render, renderHeaderFooter } from '../../../template';
import { ProposalPDFData } from '../../../types';
import PdfFactory from '../PdfFactory';

/**
 * Generates PDFs based on a user officer defined template.
 */
export class CustomProposalPdfFactory extends PdfFactory<
  ProposalPDFData,
  ProposalPDFMeta
> {
  protected template: string;
  protected countedPagesMeta: ProposalCountedPagesMeta;
  protected meta: ProposalPDFMeta = {
    files: {
      proposal: '',
      questionnaires: [],
      samples: [],
      genericTemplates: [],
      attachments: [],
      technicalReview: '',
    },
    attachmentsFileMeta: [],
    attachments: [],
  };

  static ENTITY_NAME = 'Proposal';

  constructor(entityId: number, template: string) {
    super(entityId);
    this.template = template;
  }

  init(data: ProposalPDFData) {
    const {
      questionarySteps,
      technicalReview,
      attachments,
      samples,
      genericTemplates,
    } = data;

    const noRenders = {
      waitFor: 0,
      countedPagesPerPdf: {},
    };

    this.countedPagesMeta = {
      proposal: { waitFor: 1, countedPagesPerPdf: {} },
      questionnaires: Object.assign({}, noRenders),
      technicalReview: Object.assign({}, noRenders),
      samples: Object.assign({}, noRenders),
      genericTemplates: Object.assign({}, noRenders),
      attachments: {
        waitFor: 0 /* set by fetched:attachmentsFileMeta */,
        countedPagesPerPdf: {},
      },
    };

    /**
     * Generate task list to track what needs to be done
     */
    const tasksNeeded = ['render:proposal', 'count-pages:proposal'];

    if (attachments.length > 0) {
      tasksNeeded.push('fetch:attachments');
      tasksNeeded.push('fetch:attachmentsFileMeta');
      tasksNeeded.push('count-pages:attachments');
    }

    logger.logDebug(this.logPrefix + 'tasks needed to complete', {
      tasksNeeded,
    });

    /**
     * Listeners
     */
    this.on('countPages', this.countPages);

    this.once('render:proposal', this.renderProposal);
    this.once('fetch:attachments', this.fetchAttachments);
    this.once(
      'fetch:attachmentsFileMeta',
      this.fetchAttachmentsFileMeta(['application/pdf', '^image/.*'])
    );

    this.once('rendered:proposal', (pdfPath) => {
      this.meta.files.proposal = pdfPath;
      this.emit('taskFinished', 'render:proposal');
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
        this.emit('render:proposal', { ...data, attachmentsFileMeta });

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

    if (attachments.length > 0) {
      this.meta.attachments = attachments;
      this.emit('fetch:attachmentsFileMeta', attachments);
    } else {
      this.emit('render:proposal', data);
    }
  }

  private async renderProposal(data: ProposalPDFData) {
    if (this.stopped) {
      this.emit('aborted', 'renderProposal');

      return;
    }

    const answers = extractAnswerMap(data);

    try {
      const renderedProposalHtml = await render(
        this.template,
        Object.assign({}, data, { answers })
      );
      const renderedHeaderFooter = await renderHeaderFooter(
        data.proposal.proposalId
      );

      const pdfPath = await generatePdfFromHtml(renderedProposalHtml, {
        pdfOptions: renderedHeaderFooter,
      });

      this.emit('countPages', pdfPath, 'proposal');
      this.emit('rendered:proposal', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderProposal');
    }
  }
}
