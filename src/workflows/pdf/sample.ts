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
import services from '../../services';
import { renderTemplate } from '../../template';
import { Answer, Sample, SamplePDFData } from '../../types';
import { failSafeDeleteFiles, generateTmpPath } from '../../util/fileSystem';

type SamplePDFMeta = {
  files: {
    sample: string;
    attachments: string[];
  };
  attachmentsMeta: FileMetadata[];
};

type SamplePDFPagesMeta = Record<
  keyof SamplePDFMeta['files'],
  { waitFor: number; pdfPages: Record<string, number> }
>;

class SamplePdfEmitter extends EventEmitter {
  private stopped = false;
  private pdfPageGroup: SamplePDFPagesMeta;
  private meta: SamplePDFMeta = {
    files: {
      sample: '',
      attachments: [],
    },
    attachmentsMeta: [],
  };

  init(data: SamplePDFData) {
    const { sample, sampleQuestionaryFields, attachmentIds } = data;

    this.pdfPageGroup = {
      sample: { waitFor: 1, pdfPages: {} },
      attachments: {
        waitFor: 0 /* set by fetched:attachmentsMeta */,
        pdfPages: {},
      },
    };

    /**
     * Generate task list to track what needs to be done
     */

    const tasksNeeded = ['render:sample', 'count-pages:sample'];

    if (attachmentIds.length > 0) {
      tasksNeeded.push('fetch:attachments');
      tasksNeeded.push('fetch:attachmentsMeta');
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

    this.on('error', (err, source) => {
      logger.logException(
        `[SamplePdfEmitter] Sample: ${sample.id} has unexpected error`,
        err,
        {
          source,
        }
      );
      this.stopped = true;
    });

    this.once('render:sample', this.renderSample);
    this.once('fetch:attachments', this.fetchAttachments);
    this.once('fetch:attachmentsMeta', this.fetchAttachmentsMeta);

    this.once('rendered:sample', pdfPath => {
      this.meta.files.sample = pdfPath;
      this.emit('taskFinished', 'render:sample');
    });

    this.on('fetched:attachment', attachmentPath => {
      this.meta.files.attachments.push(attachmentPath);

      if (
        this.meta.files.attachments.length === this.meta.attachmentsMeta.length
      ) {
        this.emit('taskFinished', 'fetch:attachments');
      }
    });

    this.once('fetched:attachmentsMeta', attachmentsMeta => {
      this.meta.attachmentsMeta = attachmentsMeta;
      this.pdfPageGroup.attachments.waitFor = attachmentsMeta.length;

      this.emit('taskFinished', 'fetch:attachmentsMeta');
      if (this.pdfPageGroup.attachments.waitFor === 0) {
        this.emit('taskFinished', 'fetch:attachments');
        this.emit('taskFinished', 'count-pages:attachments');
      } else {
        this.emit('fetch:attachments', attachmentsMeta);
      }
    });

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
        this.emit('done', this.meta, this.pdfPageGroup);
      }
    });

    /**
     * Emitters
     */

    this.emit('render:sample', sample, sampleQuestionaryFields);

    if (attachmentIds.length > 0) {
      this.emit('fetch:attachmentsMeta', attachmentIds);
    }
  }

  private async renderSample(
    sample: Sample,
    sampleQuestionaryFields: Answer[]
  ) {
    try {
      const renderedSampleHtml = await renderTemplate('sample.hbs', {
        sample,
        sampleQuestionaryFields,
      });
      const pdfPath = await generatePdfFromHtml(renderedSampleHtml);

      this.emit('countPages', pdfPath, 'sample');
      this.emit('rendered:sample', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderSample');
    }
  }

  private countPages(pdfPath: string, group: keyof SamplePDFMeta['files']) {
    const totalPages = getTotalPages(pdfPath);

    this.pdfPageGroup[group].pdfPages[pdfPath] = totalPages;

    if (
      Object.keys(this.pdfPageGroup[group].pdfPages).length ===
      this.pdfPageGroup[group].waitFor
    ) {
      this.emit('taskFinished', `count-pages:${group}`);
    }
  }

  private async fetchAttachmentsMeta(attachmentIds: string[]) {
    try {
      const filesMeta = await services.queries.files.getFileMetadata(
        attachmentIds,
        { mimeType: 'application/pdf' }
      );

      this.emit('fetched:attachmentsMeta', filesMeta);
    } catch (e) {
      this.emit('error', e, 'fetchAttachmentsMeta');
    }
  }

  private async fetchAttachments(attachmentsMeta: FileMetadata[]) {
    try {
      for (const { fileId } of attachmentsMeta) {
        // pre-download file
        const attachmentPath = generateTmpPath();
        await services.mutations.files.prepare(fileId, attachmentPath);

        this.emit('countPages', attachmentPath, 'attachments');
        this.emit('fetched:attachment', attachmentPath);
      }
    } catch (e) {
      this.emit('error', e, 'fetchAttachments');
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

export default async function generateSamplePDF(
  SamplePDFDataList: SamplePDFData[]
) {
  const overallMeta: Map<
    number,
    {
      meta: SamplePDFMeta;
      pdfPageGroup: SamplePDFPagesMeta;
    }
  > = new Map();

  const ee = new EventEmitter();

  const pdfEmitters: SamplePdfEmitter[] = [];

  for (let i = 0; i < SamplePDFDataList.length; i++) {
    const samplePdfEmitter = new SamplePdfEmitter();
    pdfEmitters.push(samplePdfEmitter);

    samplePdfEmitter.once('error', err => ee.emit('error', err));
    samplePdfEmitter.once('done', (meta, pdfPageGroup) => {
      overallMeta.set(i, { meta, pdfPageGroup });
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

      const { meta, pdfPageGroup } = overallMeta.get(rootIdx)!;

      const toc: TableOfContents = {
        title: `Sample: ${SamplePDFDataList[rootIdx].sample.title}`,
        page: pageNumber,
        children: [],
      };

      pageNumber += pdfPageGroup.sample.pdfPages[meta.files.sample];

      filePaths.push(meta.files.sample);

      if (meta.files.attachments.length > 0) {
        const attachmentToC: TableOfContents = {
          title: 'Attachments',
          page: pageNumber,
          children: [],
        };

        meta.files.attachments.forEach((attachment, aIdx) => {
          filePaths.push(attachment);
          attachmentToC.children.push({
            title: meta.attachmentsMeta[aIdx].originalFileName,
            page: pageNumber,
            children: [],
          });

          pageNumber += pdfPageGroup.attachments.pdfPages[attachment];
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
