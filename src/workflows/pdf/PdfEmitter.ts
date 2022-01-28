import { EventEmitter } from 'events';

import gm from 'gm';

import { FileMetadata } from '../../models/File';
import { generatePdfFromLink, generatePuppeteerPdfFooter } from '../../pdf';
import services from '../../services';
import { Attachment } from '../../types';
import { generateTmpPath, failSafeDeleteFiles } from '../../util/fileSystem';

export default abstract class PdfEmitter<T> extends EventEmitter {
  abstract init(params: T): void;

  protected fetchAttachmentsFileMeta(mimeType: string[]) {
    return async (attachments: Attachment[]) => {
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

    deleteAttachment && failSafeDeleteFiles([attachmentPath]);

    return pdfPath;
  }
}
