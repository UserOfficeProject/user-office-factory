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
} from '../../pdf';
import services from '../../services';
import { renderTemplate } from '../../template';
import { Answer, Sample, SamplePDFData, Attachment } from '../../types';
import { failSafeDeleteFiles, generateTmpPath } from '../../util/fileSystem';

type SamplePDFMeta = {
  files: {
    sample: string;
    attachments: string[];
  };
  attachmentsMeta: FileMetadata[];
  attachmentIds: Attachment[];
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
    attachmentIds: [],
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

    this.once('fetched:attachmentsMeta', (attachmentsMeta, attachmentIds) => {
      this.meta.attachmentsMeta = attachmentsMeta;
      this.pdfPageGroup.attachments.waitFor = attachmentsMeta.length;

      this.emit(
        'render:sample',
        sample,
        sampleQuestionaryFields,
        attachmentsMeta
      );

      this.emit('taskFinished', 'fetch:attachmentsMeta');
      if (this.pdfPageGroup.attachments.waitFor === 0) {
        this.emit('taskFinished', 'fetch:attachments');
        this.emit('taskFinished', 'count-pages:attachments');
      } else {
        this.emit('fetch:attachments', attachmentsMeta, attachmentIds);
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

    if (attachmentIds.length > 0) {
      this.meta.attachmentIds = attachmentIds;
      this.emit('fetch:attachmentsMeta', attachmentIds);
    } else {
      this.emit('render:sample', sample, sampleQuestionaryFields);
    }
  }

  private async renderSample(
    sample: Sample,
    sampleQuestionaryFields: Answer[],
    attachmentsMeta: FileMetadata[]
  ) {
    try {
      const renderedSampleHtml = await renderTemplate('sample.hbs', {
        sample,
        sampleQuestionaryFields,
        attachments: attachmentsMeta,
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

  private async fetchAttachmentsMeta(attachmentIds: Attachment[]) {
    try {
      const filesMeta = await services.queries.files.getFileMetadata(
        attachmentIds.map(({ id }) => id),
        { mimeType: ['application/pdf', '^image/.*'] }
      );

      this.emit('fetched:attachmentsMeta', filesMeta, attachmentIds);
    } catch (e) {
      this.emit('error', e, 'fetchAttachmentsMeta');
    }
  }

  private async fetchAttachments(
    attachmentsMeta: FileMetadata[],
    attachmentIds: Attachment[]
  ) {
    try {
      for (const attachmentMeta of attachmentsMeta) {
        const { fileId, mimeType } = attachmentMeta;
        // pre-download file
        const attachmentPath = generateTmpPath();
        await services.mutations.files.prepare(fileId, attachmentPath);

        if (mimeType.startsWith('image/')) {
          const pdfPath = await this.renderImageAttachmentPdf(
            attachmentPath,
            attachmentMeta,
            attachmentIds
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
    attachmentIds: Attachment[]
  ) {
    const attachment = attachmentIds.find(({ id }) => id === fileId);

    // the filename is our fallback option if we have no caption  or figure
    let footer = originalFileName;

    if (attachment) {
      const figure = attachment.figure ?? '';
      const caption = attachment.caption ?? '';

      footer =
        figure && caption ? `Figure ${figure}: ${caption}` : figure + caption;
    }

    const pdfPath = await generatePdfFromLink(`file://${attachmentPath}`, {
      pdfOptions: {
        margin: { top: 0, left: 0, bottom: '9mm', right: 0 },
        displayHeaderFooter: true,
        headerTemplate: '',
        footerTemplate: `<div style="font-size: 8px; padding:0; text-align: center; display:flex; margin: 0 auto;">${footer}</div>`,
      },
    });

    failSafeDeleteFiles([attachmentPath]);

    return pdfPath;
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
          const attachmentFileMeta = meta.attachmentsMeta[aIdx];
          const attachmentMeta = meta.attachmentIds.find(
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
