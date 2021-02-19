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
} from '../../pdf';
import { renderTemplate, renderHeaderFooter } from '../../template';
import { Answer, Sample, SamplePDFData, Attachment } from '../../types';
import { failSafeDeleteFiles } from '../../util/fileSystem';
import PdfFactory, { PdfFactoryCountedPagesMeta } from './PdfFactory';

type SamplePDFMeta = {
  files: {
    sample: string | null;
    attachments: string[];
  };
  attachmentsFileMeta: FileMetadata[];
  attachments: Attachment[];
};

type SamplePDFPagesMeta = PdfFactoryCountedPagesMeta<SamplePDFMeta>;

export class SamplePdfEmitter extends PdfFactory<SamplePDFData> {
  protected countedPagesMeta: SamplePDFPagesMeta;
  protected meta: SamplePDFMeta = {
    files: {
      sample: null,
      attachments: [],
    },
    attachmentsFileMeta: [],
    attachments: [],
  };

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

    logger.logDebug(
      `'[SamplePdfEmitter] Sample: ${sample.id}, tasks needed to complete'`,
      tasksNeeded
    );

    /**
     * Listeners
     */

    this.once('cleanup', this.cleanup);

    this.on('countPages', this.countPages);

    this.on('error', (err, source, ...context: any[]) => {
      logger.logException(
        `[SamplePdfEmitter] Sample: ${sample.id} has unexpected error`,
        err,
        {
          source,
          context,
        }
      );
      this.stopped = true;
    });

    this.once('render:sample', this.renderSample);
    this.once('fetch:attachments', this.fetchAttachments);
    this.once(
      'fetch:attachmentsFileMeta',
      this.fetchAttachmentsFileMeta(['application/pdf', '^image/.*'])
    );

    this.once('rendered:sample', pdfPath => {
      this.meta.files.sample = pdfPath;
      this.emit('taskFinished', 'render:sample');
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

    this.on('taskFinished', task => {
      logger.logDebug(
        `[SamplePdfEmitter] Sample: ${sample.id}, task finished`,
        { task }
      );
      tasksNeeded.splice(tasksNeeded.indexOf(task), 1);

      if (tasksNeeded.length === 0 && !this.stopped) {
        logger.logDebug(
          `[SamplePdfEmitter] Sample: ${sample.id}, every task finished`,
          { task }
        );
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
    try {
      const renderedSampleHtml = await renderTemplate('sample.hbs', {
        sample,
        sampleQuestionaryFields,
        attachmentsFileMeta,
      });
      const renderedHeaderFooter = await renderHeaderFooter();

      const pdfPath = await generatePdfFromHtml(renderedSampleHtml, {
        pdfOptions: renderedHeaderFooter,
      });

      this.emit('countPages', pdfPath, 'sample');
      this.emit('rendered:sample', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderSample');
    }
  }
}

export default async function generateSamplePDF(
  SamplePDFDataList: SamplePDFData[]
) {
  const overallMeta: Map<
    number,
    {
      meta: SamplePDFMeta;
      metaCountedPages: SamplePDFPagesMeta;
    }
  > = new Map();

  const ee = new EventEmitter();

  const pdfEmitters: SamplePdfEmitter[] = [];

  for (let i = 0; i < SamplePDFDataList.length; i++) {
    const samplePdfEmitter = new SamplePdfEmitter();
    pdfEmitters.push(samplePdfEmitter);

    samplePdfEmitter.once('error', err => ee.emit('error', err));
    samplePdfEmitter.once('done', (meta, metaCountedPages) => {
      overallMeta.set(i, { meta, metaCountedPages });
      ee.emit('pdfCreated');
    });

    samplePdfEmitter.init(SamplePDFDataList[i]);
  }

  ee.once('error', () =>
    pdfEmitters.forEach(pdfEmitter => pdfEmitter.emit('cleanup'))
  );
  ee.once('cleanup', () =>
    pdfEmitters.forEach(pdfEmitter => pdfEmitter.emit('cleanup'))
  );

  const sampleIds = SamplePDFDataList.map(({ sample }) => sample.id);

  const finalizePDF = () => {
    logger.logDebug('[generateSamplePdf] PDF created', { sampleIds });

    const filePaths: string[] = [];

    const rootToC: TableOfContents[] = [];
    let pageNumber = 0;

    for (let rootIdx = 0; rootIdx < SamplePDFDataList.length; rootIdx++) {
      if (!overallMeta.has(rootIdx)) {
        logger.logError(`'${rootIdx}' is missing from overallMeta`, {
          overallMeta,
        });
        throw new Error(`'${rootIdx}' is missing from overallMeta`);
      }

      const { meta, metaCountedPages } = overallMeta.get(rootIdx)!;

      const toc: TableOfContents = {
        title: `Sample: ${SamplePDFDataList[rootIdx].sample.title}`,
        page: pageNumber,
        children: [],
      };

      pageNumber +=
        metaCountedPages.sample.countedPagesPerPdf[meta.files.sample!];

      filePaths.push(meta.files.sample!);

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
    }

    const mergedPdfPath = mergePDF(filePaths);
    const pdfPath = writeToC(mergedPdfPath, rootToC);

    logger.logDebug('[generateSamplePdf] PDF merged', {
      pdfPath,
      sampleIds,
    });

    const rs = createReadStream(pdfPath).once('close', () =>
      // after the steam is closed clean up all files
      failSafeDeleteFiles([mergedPdfPath, pdfPath])
    );

    ee.emit('cleanup');
    ee.emit('finished', rs);
  };

  ee.on('pdfCreated', () => {
    if (overallMeta.size === SamplePDFDataList.length) {
      finalizePDF();
    }
  });

  return new Promise<Readable>((resolve, reject) => {
    ee.once('error', err => reject(err));
    ee.once('finished', rs => resolve(rs));
  });
}
