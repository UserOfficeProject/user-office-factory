import { EventEmitter } from 'events';

import { logger } from '@user-office-software/duo-logger';
import gm from 'gm';
import delay from 'lodash/delay';

import { FileMetadata } from '../../models/File';
import {
  generatePdfFromLink,
  generatePuppeteerPdfFooter,
  getTotalPages,
} from '../../pdf';
import services from '../../services';
import { Attachment, Role } from '../../types';
import { generateTmpPath, failSafeDeleteFiles } from '../../util/fileSystem';

export type PdfFactoryMeta = {
  files: { [k: string]: string | string[] };
  isPregeneratedPdfMeta: boolean;
};

export abstract class PdfFactoryPicker<
  TFactoryData,
  TPdfFactoryMeta extends PdfFactoryMeta,
> {
  public abstract getFactory(
    data: TFactoryData,
    entityId: number,
    userRole: Role
  ): PdfFactory<TFactoryData, TPdfFactoryMeta>;
}

export type PdfFactoryCountedPagesMeta<T extends PdfFactoryMeta> = Record<
  keyof T['files'],
  { waitFor: number; countedPagesPerPdf: Record<string, number> }
>;

export default abstract class PdfFactory<
  TData,
  TPdfFactoryMeta extends PdfFactoryMeta,
> extends EventEmitter {
  static ENTITY_NAME: string;

  protected entityId: number;
  protected userRole: Role;
  protected stopped = false;
  protected aborted = false;

  protected abstract meta: TPdfFactoryMeta;
  protected abstract countedPagesMeta: PdfFactoryCountedPagesMeta<TPdfFactoryMeta>;

  abstract init(params: TData): void;

  get logPrefix() {
    const entityName = (this.constructor as typeof PdfFactory).ENTITY_NAME;

    return `[${this.constructor.name}] ${entityName}, ${this.entityId}: `;
  }

  constructor(entityId: number, userRole: Role) {
    super();

    this.entityId = entityId;
    this.userRole = userRole;
    this.on('aborted', (action, ctx: Record<string, unknown>) => {
      logger.logWarn(this.logPrefix + `${action} was aborted`, { ...ctx });
    });

    this.on('error', (err, source, context) => {
      logger.logException(this.logPrefix + 'had unexpected error', err, {
        source,
        context,
      });

      // `abort` is called by PdfWorkflowManager
      this.stopped = true;
    });
  }

  onceError(cb: (err: Error) => void) {
    this.once('error', cb);
  }

  onceDone(
    cb: (
      meta: TPdfFactoryMeta,
      countedPagesMeta: PdfFactoryCountedPagesMeta<TPdfFactoryMeta>
    ) => void
  ) {
    this.once('done', cb);
  }

  protected fetchAttachmentsFileMeta(mimeType: string[]) {
    return async (attachments: Attachment[]) => {
      if (this.stopped) {
        this.emit('aborted', 'fetchAttachmentsFileMeta');

        return;
      }

      try {
        const filesMeta = await services.queries.files.getFileMetadata(
          attachments.map(({ id }) => id),
          { mimeType }
        );

        this.emit('fetched:attachmentsFileMeta', filesMeta, attachments);
      } catch (e) {
        this.emit('error', e, 'fetchAttachmentsMeta');
      }
    };
  }

  protected async fetchAttachments(
    attachmentsFileMeta: FileMetadata[],
    attachments: Attachment[]
  ) {
    try {
      for (const attachmentFileMeta of attachmentsFileMeta) {
        if (this.stopped) {
          this.emit('aborted', 'fetchAttachments');

          return;
        }

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

  protected async renderImageAttachmentPdf(
    attachmentPath: string,
    { fileId, originalFileName, mimeType }: FileMetadata,
    attachments: Attachment[]
  ) {
    const attachment = attachments.find(({ id }) => id === fileId);

    // the filename is our fallback option if we have no caption  or figure
    let footer = originalFileName;
    const deleteAttachment = true;

    if (attachment) {
      const figure = attachment.figure ? `Figure ${attachment.figure}` : '';
      const caption = attachment.caption ?? '';

      footer = figure && caption ? `${figure}: ${caption}` : figure + caption;
    }

    if (mimeType === 'image/tiff') {
      const outputPath = `${generateTmpPath()}.png`;
      const newFilePath = await new Promise<string>((resolve, reject) => {
        gm(`TIFF:${attachmentPath}`).write(`${outputPath}`, (err) =>
          err ? reject(err) : resolve(outputPath)
        );
      });

      // delete the original .tiff file
      failSafeDeleteFiles([attachmentPath]);
      attachmentPath = newFilePath;
    }

    const pdfPath = await generatePdfFromLink(`file://${attachmentPath}`, {
      pdfOptions: generatePuppeteerPdfFooter(footer),
    });

    if (deleteAttachment) {
      failSafeDeleteFiles([attachmentPath]);
    }

    return pdfPath;
  }

  protected countPages(
    pdfPath: string,
    group: keyof PdfFactoryMeta['files'],
    attempt = 1
  ) {
    if (this.stopped) {
      this.emit('aborted', 'countPages', { pdfPath, group, attempt });

      failSafeDeleteFiles([pdfPath]);

      return;
    }

    try {
      const totalPages = getTotalPages(pdfPath);

      this.countedPagesMeta[group].countedPagesPerPdf[pdfPath] = totalPages;

      if (
        Object.keys(this.countedPagesMeta[group].countedPagesPerPdf).length ===
        this.countedPagesMeta[group].waitFor
      ) {
        this.emit('taskFinished', `count-pages:${group}`);
      }
    } catch (e) {
      if (attempt >= 3) {
        this.emit('error', e, 'countPages', { pdfPath, group });
      } else {
        delay(() => this.emit('countPages', pdfPath, group, attempt + 1), 100);
      }
    }
  }

  abort() {
    this.aborted = true;
    this.cleanup();
  }

  async cleanup() {
    if (this.aborted) {
      logger.logWarn(this.logPrefix + 'was aborted', {});
      this.stopped = true;
    }

    Object.values(this.meta.files).forEach((filePaths) => {
      if (!filePaths) {
        return;
      }

      if (typeof filePaths === 'string') {
        failSafeDeleteFiles([filePaths]);
      } else {
        failSafeDeleteFiles(filePaths);
      }
    });
  }
}
