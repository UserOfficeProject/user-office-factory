import { logger } from '@user-office-software/duo-logger';

import { generatePdfFromHtml } from '../../../pdf';
import { render, renderHeaderFooter } from '../../../template';
import {
  Answer,
  GenericTemplate,
  GenericTemplateAnswer,
  ProposalPDFData,
} from '../../../types';
import PdfFactory from '../PdfFactory';
import { ProposalPDFMeta, ProposalCountedPagesMeta } from './ProposalPDFMeta';

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
      attachments: Object.assign({}, noRenders),
    };

    /**
     * Generate task list to track what needs to be done
     */
    const tasksNeeded = ['render:proposal', 'count-pages:proposal'];

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
    this.emit('render:proposal', data);

    if (technicalReview) {
      this.emit('render:technicalReview', technicalReview);
    }

    if (attachments.length > 0) {
      this.meta.attachments = attachments;
      this.emit('fetch:attachmentsFileMeta', attachments);
    } else {
      if (questionarySteps.length > 0) {
        this.emit(
          'render:questionnaires',
          questionarySteps,
          genericTemplates,
          []
        );
      }

      if (samples.length > 0) {
        this.emit('render:samples', samples, []);
      }
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
}

type ValueHandler = (data: ProposalPDFData, questionaryStep: Answer) => unknown;

const valueHandlers: Record<string, ValueHandler> = {
  GENERIC_TEMPLATE: (data, q) => extractGenericTemplateAnswerMap(data, q),
};

function getValueHandlerOrDefault(type: string): ValueHandler {
  const handler = valueHandlers[type];
  if (handler === undefined) {
    return (_, q) => q.value;
  } else {
    return valueHandlers[type];
  }
}

function extractAnswerMap(data: ProposalPDFData) {
  return data.questionarySteps
    .flatMap((questionaryStep) => questionaryStep.fields)
    .flatMap((answer) => ({
      key: answer.question.naturalKey,
      value: getValueHandlerOrDefault(answer.question.dataType)(data, answer),
    }))
    .reduce((p: Record<string, unknown>, v) => {
      p[v.key] = v.value;

      return p;
    }, {});
}

function extractGenericTemplateAnswerMap(
  data: ProposalPDFData,
  answer: Answer
) {
  return answer.value
    .map((a: GenericTemplateAnswer) =>
      data.genericTemplates.find(
        (g) =>
          g.genericTemplate.questionaryId === a.questionaryId &&
          g.genericTemplate.questionId === a.questionId
      )
    )
    .map((g: GenericTemplate) =>
      g.genericTemplateQuestionaryFields
        .map((f) => {
          if (f.question.dataType === 'GENERIC_TEMPLATE_BASIS') {
            return {
              key: 'generic_template_basis',
              value: g.genericTemplate.title,
            };
          } else {
            return {
              key: f.question.naturalKey,
              value: f.value,
            };
          }
        })
        .reduce((p: Record<string, string>, v: any) => {
          p[v.key] = v.value;

          return p;
        }, {})
    );
}
