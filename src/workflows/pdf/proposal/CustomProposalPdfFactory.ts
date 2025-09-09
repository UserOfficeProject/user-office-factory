import { join } from 'path';

import { logger } from '@user-office-software/duo-logger';

import { FullProposalPDFMeta } from './ProposalPDFMeta';
import { extractAnswerMap } from './QuestionAnswerMapper';
import { FileMetadata } from '../../../models/File';
import { generatePdfFromHtml } from '../../../pdf';
import { render, renderFooter, renderHeader } from '../../../template';
import { FullProposalPDFData, ProposalSampleData, Role } from '../../../types';
import { insertScriptInBottom, insertScriptInTop } from '../../../util/pdfHtml';
import { computeTableOfContents, pagedJs } from '../../../util/pdfHtmlScript';
import PdfFactory, { PdfFactoryCountedPagesMeta } from '../PdfFactory';

/**
 * Generates PDFs based on a user officer defined template.
 */
export class CustomProposalPdfFactory extends PdfFactory<
  FullProposalPDFData,
  FullProposalPDFMeta
> {
  protected templateBody: string;
  protected templateHeader?: string;
  protected templateFooter?: string;
  protected sampleDeclaration?: string;

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

  constructor(
    entityId: number,
    userRole: Role,
    templateBody: string,
    templateHeader?: string,
    templateFooter?: string,
    sampleDeclaration?: string
  ) {
    super(entityId, userRole);
    this.templateBody = templateBody;
    this.templateHeader = templateHeader;
    this.templateFooter = templateFooter;
    this.sampleDeclaration = sampleDeclaration;
  }

  init(data: FullProposalPDFData) {
    try {
      const { samples, attachments } = data;

      const noRenders = {
        waitFor: 0,
        countedPagesPerPdf: {},
      };

      this.countedPagesMeta = {
        proposal: { waitFor: 1, countedPagesPerPdf: {} },
        questionnaires: Object.assign({}, noRenders),
        technicalReview: Object.assign({}, noRenders),
        samples: { waitFor: samples.length, countedPagesPerPdf: {} },
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
      // If the Sample Declaration Questionaries are present and answered And there is a template written for the sample declaration, then push the job
      if (samples.length > 0 && this.sampleDeclaration) {
        tasksNeeded.push('render:samples');
        tasksNeeded.push('count-pages:samples');
      }

      logger.logDebug(this.logPrefix + 'tasks needed to complete', {
        tasksNeeded,
      });

      /**
       * Listeners
       */
      this.on('countPages', this.countPages);

      this.once('render:proposal', this.renderProposal);
      this.once('render:samples', this.renderSamples);
      this.once('fetch:attachments', this.fetchAttachments);
      this.once(
        'fetch:attachmentsFileMeta',
        this.fetchAttachmentsFileMeta(['application/pdf', '^image/.*'])
      );

      this.once('rendered:proposal', (pdf) => {
        this.meta.files.proposal = pdf.pdfPath;
        this.meta.toc.proposal = pdf.toc;
        this.emit('taskFinished', 'render:proposal');
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
          this.countedPagesMeta.attachments.waitFor =
            attachmentsFileMeta.length;

          this.emit('taskFinished', 'fetch:attachmentsFileMeta');
          this.emit('render:proposal', {
            ...data,
            attachmentsFileMeta,
            userRole: this.userRole,
          });

          // If the Sample Declaration Questionaries are present and answered And there is a template written for the sample declaration, then start the job
          if (samples.length > 0 && this.sampleDeclaration) {
            this.emit(
              'render:samples',
              { ...data, userRole: this.userRole },
              samples,
              attachmentsFileMeta
            );
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

      if (attachments.length > 0) {
        this.meta.attachments = attachments;
        this.emit('fetch:attachmentsFileMeta', attachments);
      } else {
        this.emit('render:proposal', data);

        // If the Sample Declaration Questionaries are present and answered And there is a template written for the sample declaration, then start the job
        if (samples.length > 0 && this.sampleDeclaration) {
          this.emit(
            'render:samples',
            { ...data, userRole: this.userRole },
            samples,
            []
          );
        }
      }
    } catch (e) {
      logger.logError('Uncatched exception', { error: e });
    }
  }

  private async renderProposal(data: FullProposalPDFData) {
    if (this.stopped) {
      this.emit('aborted', 'renderProposal');

      return;
    }

    const answers = extractAnswerMap(data);

    try {
      let templateBodyAfterInjectingScript = insertScriptInTop(
        this.templateBody,
        pagedJs
      );

      templateBodyAfterInjectingScript = insertScriptInBottom(
        templateBodyAfterInjectingScript,
        computeTableOfContents
      );

      const renderedProposalHtml = await render(
        templateBodyAfterInjectingScript,
        Object.assign({}, data, { answers })
      );

      const headerTemplate = this.templateHeader
        ? await render(this.templateHeader, {
            ...data,
            logoPath: process.env.HEADER_LOGO_PATH
              ? process.env.HEADER_LOGO_PATH
              : join(process.cwd(), './templates/images/ESS.png'),
          })
        : await renderHeader(data.proposal.proposalId);

      const footerTemplate = this.templateFooter
        ? await render(this.templateFooter, data)
        : await renderFooter();

      const pdfOptions = {
        margin: {
          top: 82,
          left: 72,
          bottom: 72,
          right: 72,
        },
        displayHeaderFooter: true,
        headerTemplate: headerTemplate,
        footerTemplate: footerTemplate,
      };

      const pdf = await generatePdfFromHtml(renderedProposalHtml, {
        pdfOptions: pdfOptions,
      });

      this.emit('countPages', pdf.pdfPath, 'proposal');
      this.emit('rendered:proposal', pdf);
    } catch (e) {
      this.emit('error', e, 'renderProposal');
    }
  }

  private async renderSamples(
    data: FullProposalPDFData,
    samples: ProposalSampleData[],
    attachmentsFileMeta: FileMetadata[]
  ) {
    // TODO: This needs to be tested
    if (this.sampleDeclaration) {
      try {
        for (const { sample, sampleQuestionaryFields } of samples) {
          if (this.stopped) {
            this.emit('aborted', 'renderSamples');

            return;
          }

          const renderedProposalSample = await render(this.sampleDeclaration, {
            sample,
            sampleQuestionaryFields,
            attachmentsFileMeta,
          });

          // TODO: This needs to be optimised, as this is a redundant code from renderProposal method
          const headerTemplate = this.templateHeader
            ? await render(this.templateHeader, {
                ...data,
                logoPath: process.env.HEADER_LOGO_PATH
                  ? process.env.HEADER_LOGO_PATH
                  : join(process.cwd(), './templates/images/ESS.png'),
              })
            : await renderHeader(data.proposal.proposalId);

          const footerTemplate = this.templateFooter
            ? await render(this.templateFooter, data)
            : await renderFooter();

          const pdfOptions = {
            margin: {
              top: 82,
              left: 72,
              bottom: 72,
              right: 72,
            },
            displayHeaderFooter: true,
            headerTemplate: headerTemplate,
            footerTemplate: footerTemplate,
          };

          const pdf = await generatePdfFromHtml(renderedProposalSample, {
            pdfOptions: pdfOptions,
          });
          console.info({ pdfPath: pdf.pdfPath });
          this.emit('countPages', pdf.pdfPath, 'samples');
          this.emit('rendered:sample', pdf);
        }
      } catch (e) {
        this.emit('error', e, 'renderSamples');
      }
    }
  }
}
