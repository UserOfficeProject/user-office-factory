import { logger } from '@user-office-software/duo-logger';

import PdfFactory, { PdfFactoryCountedPagesMeta } from './PdfFactory';
import PdfWorkflowManager from './PdfWorkflowManager';
import { FileMetadata } from '../../models/File';
import { generatePdfFromHtml, TableOfContents } from '../../pdf';
import { renderTemplate, renderHeaderFooter } from '../../template';
import { Answer, Sample, SamplePDFData, Attachment, Role } from '../../types';

type SamplePDFMeta = {
  files: {
    sample: string;
    attachments: string[];
  };
  attachmentsFileMeta: FileMetadata[];
  attachments: Attachment[];
  isPregeneratedPdfMeta: false;
};

type SamplePDFPagesMeta = PdfFactoryCountedPagesMeta<SamplePDFMeta>;

export class SamplePdfFactory extends PdfFactory<SamplePDFData, SamplePDFMeta> {
  protected countedPagesMeta: SamplePDFPagesMeta;
  protected meta: SamplePDFMeta = {
    files: {
      sample: '',
      attachments: [],
    },
    attachmentsFileMeta: [],
    attachments: [],
    isPregeneratedPdfMeta: false,
  };

  static ENTITY_NAME = 'Sample';

  init(data: SamplePDFData) {
    const { sample, sampleQuestionaryFields, attachments } = data;

    this.countedPagesMeta = {
      sample: { waitFor: 1, countedPagesPerPdf: {} },
      attachments: {
        waitFor: 0 /* set by fetched:attachmentsFileMeta */,
        countedPagesPerPdf: {},
      },
    };

    /**
     * Generate task list to track what needs to be done
     */

    const tasksNeeded = ['render:sample', 'count-pages:sample'];

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

    this.once('cleanup', this.cleanup);

    this.on('countPages', this.countPages);

    this.once('render:sample', this.renderSample);
    this.once('fetch:attachments', this.fetchAttachments);
    this.once(
      'fetch:attachmentsFileMeta',
      this.fetchAttachmentsFileMeta(['application/pdf', '^image/.*'])
    );

    this.once('rendered:sample', (pdf) => {
      this.meta.files.sample = pdf.pdfPath;
      this.emit('taskFinished', 'render:sample');
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

        this.emit(
          'render:sample',
          sample,
          sampleQuestionaryFields,
          attachmentsFileMeta
        );

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

    if (attachments.length > 0) {
      this.meta.attachments = attachments;
      this.emit('fetch:attachmentsFileMeta', attachments);
    } else {
      this.emit('render:sample', sample, sampleQuestionaryFields);
    }
  }

  private async renderSample(
    sample: Sample,
    sampleQuestionaryFields: Answer[],
    attachmentsFileMeta: FileMetadata[]
  ) {
    if (this.stopped) {
      this.emit('aborted', 'renderSample');

      return;
    }

    try {
      const renderedSampleHtml = await renderTemplate('sample.hbs', {
        sample,
        sampleQuestionaryFields,
        attachmentsFileMeta,
      });
      const renderedHeaderFooter = await renderHeaderFooter();

      const pdf = await generatePdfFromHtml(renderedSampleHtml, {
        pdfOptions: renderedHeaderFooter,
      });

      if (pdf) {
        this.emit('countPages', pdf.pdfPath, 'sample');
        this.emit('rendered:sample', pdf);
      }
    } catch (e) {
      this.emit('error', e, 'renderSample');
    }
  }
}

export default function newSamplePdfWorkflowManager(
  data: SamplePDFData[],
  userRole: Role
) {
  const manager = new PdfWorkflowManager<SamplePDFData, SamplePDFMeta>(
    SamplePdfFactory,
    data,
    (data) => data.sample.id,
    userRole
  );

  manager.onFinalizePDF(
    ({ data, filePaths, meta, metaCountedPages, pageNumber, rootToC }) => {
      const toc: TableOfContents = {
        title: `Sample: ${data.sample.title}`,
        page: pageNumber,
        children: [],
      };

      pageNumber +=
        metaCountedPages.sample.countedPagesPerPdf[meta.files.sample];

      filePaths.push(meta.files.sample);

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

      rootToC.push(toc);

      return pageNumber;
    }
  );

  manager.start();

  return manager;
}
