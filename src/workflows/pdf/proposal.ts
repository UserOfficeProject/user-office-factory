import { EventEmitter } from 'events';
import { createReadStream } from 'fs';
import { Readable } from 'stream';

import { logger } from '@esss-swap/duo-logger';

import { FileMetadata } from '../../models/File';
import {
  generatePdfFromHtml,
  getTotalPages,
  mergePDF,
  writeToC,
  TableOfContents,
  generatePdfFromLink,
  generatePuppeteerPdfFooter,
} from '../../pdf';
import services from '../../services';
import { renderTemplate } from '../../template';
import {
  BasicUser,
  Proposal,
  QuestionaryStep,
  ProposalPDFData,
  ProposalSampleData,
  Attachment,
} from '../../types';
import { failSafeDeleteFiles, generateTmpPath } from '../../util/fileSystem';

type ProposalPDFMeta = {
  files: {
    proposal: string;
    questionnaires: string[];
    samples: string[];
    attachments: string[];
    technicalReview?: string;
  };
  attachmentsFileMeta: FileMetadata[];
  attachments: Attachment[];
};

type ProposalPDFPagesMeta = Record<
  keyof ProposalPDFMeta['files'],
  { waitFor: number; pdfPages: Record<string, number> }
>;

class ProposalPdfEmitter extends EventEmitter {
  private stopped = false;
  private pdfPageGroup: ProposalPDFPagesMeta;
  private meta: ProposalPDFMeta = {
    files: {
      proposal: '',
      questionnaires: [],
      samples: [],
      attachments: [],
    },
    attachmentsFileMeta: [],
    attachments: [],
  };

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

    this.pdfPageGroup = {
      proposal: { waitFor: 1, pdfPages: {} },
      questionnaires: {
        waitFor: questionarySteps.length,
        pdfPages: {},
      },
      technicalReview: { waitFor: technicalReview ? 1 : 0, pdfPages: {} },
      samples: { waitFor: samples.length, pdfPages: {} },
      attachments: {
        waitFor: 0 /* set by fetched:attachmentsFileMeta */,
        pdfPages: {},
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

    logger.logDebug(
      `'[ProposalPdfEmitter] Proposal: ${proposal.id}, tasks needed to complete'`,
      tasksNeeded
    );

    /**
     * Listeners
     */

    this.once('cleanup', this.cleanup);

    this.on('countPages', this.countPages);

    this.on('error', (err, source) => {
      logger.logException(
        `[ProposalPdfEmitter] Proposal: ${proposal.id} has unexpected error`,
        err,
        {
          source,
        }
      );
      this.stopped = true;
    });

    this.once('render:proposal', this.renderProposal);
    this.once('render:questionnaires', this.renderQuestionarySteps);
    this.once('render:technicalReview', this.renderTechnicalReview);
    this.once('render:samples', this.renderSamples);
    this.once('fetch:attachments', this.fetchAttachments);
    this.once('fetch:attachmentsFileMeta', this.fetchAttachmentsFileMeta);

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

      if (this.meta.files.questionnaires.length === questionarySteps.length) {
        this.emit('taskFinished', 'render:questionnaires');
      }
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
        this.pdfPageGroup.attachments.waitFor = attachmentsFileMeta.length;

        this.emit('taskFinished', 'fetch:attachmentsFileMeta');
        this.emit(
          'render:questionnaires',
          questionarySteps,
          attachmentsFileMeta
        );

        if (samples.length > 0) {
          this.emit('render:samples', samples, attachmentsFileMeta);
        }

        if (this.pdfPageGroup.attachments.waitFor === 0) {
          this.emit('taskFinished', 'fetch:attachments');
          this.emit('taskFinished', 'count-pages:attachments');
        } else {
          this.emit('fetch:attachments', attachmentsFileMeta, attachments);
        }
      }
    );

    this.on('taskFinished', task => {
      logger.logDebug(
        `[ProposalPdfEmitter] Proposal: ${proposal.id}, task finished`,
        { task }
      );
      tasksNeeded.splice(tasksNeeded.indexOf(task), 1);

      if (tasksNeeded.length === 0 && !this.stopped) {
        logger.logDebug(
          `[ProposalPdfEmitter] Proposal: ${proposal.id}, every task finished`,
          { task }
        );
        this.emit('done', this.meta, this.pdfPageGroup);
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
    }
  }

  private async renderProposal(
    proposal: Proposal,
    principalInvestigator: BasicUser,
    coProposers: BasicUser[]
  ) {
    try {
      const renderedProposalHtml = await renderTemplate('proposal-main.hbs', {
        proposal,
        principalInvestigator,
        coProposers,
      });
      const pdfPath = await generatePdfFromHtml(renderedProposalHtml);

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
    try {
      for (const questionaryStep of questionarySteps) {
        if (this.stopped) {
          return;
        }

        const renderedProposalQuestion = await renderTemplate(
          'questionary-step.hbs',
          { step: questionaryStep, attachmentsFileMeta }
        );

        const pdfPath = await generatePdfFromHtml(renderedProposalQuestion);

        this.emit('countPages', pdfPath, 'questionnaires');
        this.emit('rendered:questionary', pdfPath);
      }
    } catch (e) {
      this.emit('error', e, 'renderQuestionarySteps');
    }
  }

  private async renderTechnicalReview(technicalReview: {
    status: string;
    timeAllocation: number;
    publicComment: string;
  }) {
    try {
      const renderedTechnicalReview = await renderTemplate(
        'technical-review.hbs',
        { technicalReview }
      );
      const pdfPath = await generatePdfFromHtml(renderedTechnicalReview);

      this.emit('countPages', pdfPath, 'technicalReview');
      this.emit('rendered:technicalReview', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderTechnicalReview');
    }
  }

  private async fetchAttachmentsFileMeta(attachments: Attachment[]) {
    try {
      const filesMeta = await services.queries.files.getFileMetadata(
        attachments.map(({ id }) => id),
        { mimeType: ['application/pdf', '^image/.*'] }
      );

      this.emit('fetched:attachmentsFileMeta', filesMeta, attachments);
    } catch (e) {
      this.emit('error', e, 'fetchAttachmentsMeta');
    }
  }

  private async fetchAttachments(
    attachmentsFileMeta: FileMetadata[],
    attachments: Attachment[]
  ) {
    try {
      for (const attachmentFileMeta of attachmentsFileMeta) {
        const { fileId, mimeType } = attachmentFileMeta;
        // pre-download file
        const attachmentPath = generateTmpPath();
        await services.mutations.files.prepare(fileId, attachmentPath);

        if (mimeType.startsWith('image/')) {
          const pdfPath = await this.renderImageAttachmentPdf(
            attachmentPath,
            attachmentFileMeta,
            attachments
          );

          this.emit('countPages', pdfPath, 'attachments');
          this.emit('fetched:attachment', pdfPath);
        } else {
          this.emit('countPages', attachmentPath, 'attachments');
          this.emit('fetched:attachment', attachmentPath);
        }
      }
    } catch (e) {
      this.emit('error', e, 'fetchAttachments');
    }
  }

  private async renderImageAttachmentPdf(
    attachmentPath: string,
    { fileId, originalFileName }: FileMetadata,
    attachments: Attachment[]
  ) {
    const attachment = attachments.find(({ id }) => id === fileId);

    // the filename is our fallback option if we have no caption  or figure
    let footer = originalFileName;

    if (attachment) {
      const figure = attachment.figure ?? '';
      const caption = attachment.caption ?? '';

      footer =
        figure && caption ? `Figure ${figure}: ${caption}` : figure + caption;
    }

    const pdfPath = await generatePdfFromLink(`file://${attachmentPath}`, {
      pdfOptions: generatePuppeteerPdfFooter(footer),
    });

    failSafeDeleteFiles([attachmentPath]);

    return pdfPath;
  }

  private async renderSamples(
    samples: ProposalSampleData[],
    attachmentsFileMeta: FileMetadata[]
  ) {
    try {
      for (const { sample, sampleQuestionaryFields } of samples) {
        if (this.stopped) {
          return;
        }

        const renderedProposalSample = await renderTemplate('sample.hbs', {
          sample,
          sampleQuestionaryFields,
          attachmentsFileMeta,
        });

        const pdfPath = await generatePdfFromHtml(renderedProposalSample);

        this.emit('countPages', pdfPath, 'samples');
        this.emit('rendered:sample', pdfPath);
      }
    } catch (e) {
      this.emit('error', e, 'renderSamples');
    }
  }

  private countPages(pdfPath: string, group: keyof ProposalPDFMeta['files']) {
    const totalPages = getTotalPages(pdfPath);

    this.pdfPageGroup[group].pdfPages[pdfPath] = totalPages;

    if (
      Object.keys(this.pdfPageGroup[group].pdfPages).length ===
      this.pdfPageGroup[group].waitFor
    ) {
      this.emit('taskFinished', `count-pages:${group}`);
    }
  }

  private async cleanup() {
    this.stopped = true;

    Object.values(this.meta.files).forEach(filePaths => {
      if (!filePaths) {
        return;
      }

      typeof filePaths === 'string'
        ? failSafeDeleteFiles([filePaths])
        : failSafeDeleteFiles(filePaths);
    });
  }
}

export default async function generateProposalPDF(
  proposalPdfDataList: ProposalPDFData[]
) {
  const overallMeta: Map<
    number,
    {
      meta: ProposalPDFMeta;
      pdfPageGroup: ProposalPDFPagesMeta;
    }
  > = new Map();

  const ee = new EventEmitter();

  const pdfEmitters: ProposalPdfEmitter[] = [];

  for (let i = 0; i < proposalPdfDataList.length; i++) {
    const proposalPdfEmitter = new ProposalPdfEmitter();
    pdfEmitters.push(proposalPdfEmitter);

    proposalPdfEmitter.once('error', err => ee.emit('error', err));
    proposalPdfEmitter.once('done', (meta, pdfPageGroup) => {
      overallMeta.set(i, { meta, pdfPageGroup });
      ee.emit('pdfCreated');
    });

    proposalPdfEmitter.init(proposalPdfDataList[i]);
  }

  ee.once('error', () =>
    pdfEmitters.forEach(pdfEmitter => pdfEmitter.emit('cleanup'))
  );
  ee.once('cleanup', () =>
    pdfEmitters.forEach(pdfEmitter => pdfEmitter.emit('cleanup'))
  );

  const proposalIds = proposalPdfDataList.map(({ proposal }) => proposal.id);

  const finalizePDF = () => {
    logger.logDebug('[generateProposalPdf] PDF created', { proposalIds });

    const filePaths: string[] = [];

    const rootToC: TableOfContents[] = [];
    let pageNumber = 0;

    for (let rootIdx = 0; rootIdx < proposalPdfDataList.length; rootIdx++) {
      if (!overallMeta.has(rootIdx)) {
        logger.logError(`'${rootIdx}' is missing from overallMeta`, {
          overallMeta,
        });
        throw new Error(`'${rootIdx}' is missing from overallMeta`);
      }

      const { meta, pdfPageGroup } = overallMeta.get(rootIdx)!;

      const toc: TableOfContents = {
        title: `Proposal number: ${proposalPdfDataList[rootIdx].proposal.shortCode}`,
        page: pageNumber,
        children: [],
      };

      pageNumber += pdfPageGroup.proposal.pdfPages[meta.files.proposal];

      filePaths.push(meta.files.proposal);

      meta.files.questionnaires.forEach((questionary, qIdx) => {
        filePaths.push(questionary);
        toc.children.push({
          title:
            proposalPdfDataList[rootIdx].questionarySteps[qIdx].topic.title,
          page: pageNumber,
          children: [],
        });

        pageNumber += pdfPageGroup.questionnaires.pdfPages[questionary];
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
            title: `Sample: ${proposalPdfDataList[rootIdx].samples[qIdx].sample.title}`,
            page: pageNumber,
            children: [],
          });

          pageNumber += pdfPageGroup.samples.pdfPages[sample];
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

          pageNumber += pdfPageGroup.attachments.pdfPages[attachment];
        });

        toc.children.push(attachmentToC);
      }

      if (meta.files.technicalReview) {
        filePaths.push(meta.files.technicalReview);
        toc.children.push({
          title: 'Technical Review',
          page: pageNumber,
          children: [],
        });

        pageNumber +=
          pdfPageGroup.technicalReview.pdfPages[meta.files.technicalReview];
      }

      rootToC.push(toc);
    }

    const mergedPdfPath = mergePDF(filePaths);
    const pdfPath = writeToC(mergedPdfPath, rootToC);

    logger.logDebug('[generateProposalPdf] PDF merged', {
      pdfPath,
      proposalIds,
    });

    const rs = createReadStream(pdfPath).once('close', () =>
      // after the steam is closed clean up all files
      failSafeDeleteFiles([mergedPdfPath, pdfPath])
    );

    ee.emit('cleanup');
    ee.emit('finished', rs);
  };

  ee.on('pdfCreated', () => {
    if (overallMeta.size === proposalPdfDataList.length) {
      finalizePDF();
    }
  });

  return new Promise<Readable>((resolve, reject) => {
    ee.once('error', err => reject(err));
    ee.once('finished', rs => resolve(rs));
  });
}
