import { logger } from '@user-office-software/duo-logger';

import AttachmentFactory, { AttachmentFactoryMeta } from './AttachmentFactory';
import ZipWorkflowManager from './ZipWorkflowManager';
import { FileMetadata } from '../../models/File';
import services from '../../services';
import { Attachment, FullProposalPDFData } from '../../types';
import { generateTmpPath } from '../../util/fileSystem';

export type AttachmentData = Pick<
  FullProposalPDFData,
  'proposal' | 'attachments'
>;

export class AttachmentZipFactory extends AttachmentFactory<
  AttachmentData,
  AttachmentFactoryMeta
> {
  protected meta: AttachmentFactoryMeta = {
    proposal: '',
    files: [],
  };

  static ENTITY_NAME = 'Attachment';

  init(data: AttachmentData) {
    const { proposal, attachments } = data;

    /**
     * Generate task list to track what needs to be done
     */

    const tasksNeeded = ['fetch:attachments', 'fetch:attachmentsFileMeta'];

    logger.logDebug(this.logPrefix + 'tasks needed to complete', {
      tasksNeeded,
    });

    /**
     * Listeners
     */

    this.once('cleanup', this.cleanup);

    this.once('fetch:attachments', this.fetchAttachments);
    this.once('fetch:attachmentsFileMeta', this.fetchAttachmentsFileMeta());

    this.on('fetched:attachment', (file, attachmentsFileMeta) => {
      this.meta.files.push(file);
      if (this.meta.files.length === attachmentsFileMeta.length) {
        this.emit('taskFinished', 'fetch:attachments');
      }
    });

    this.once(
      'fetched:attachmentsFileMeta',
      (attachmentsFileMeta, attachments) => {
        if (attachmentsFileMeta.length <= 0) {
          this.emit('done', this.meta);
        }
        this.emit('fetch:attachments', attachmentsFileMeta, attachments);
      }
    );

    this.on('taskFinished', (task) => {
      logger.logDebug(this.logPrefix + 'task finished', { task });
      tasksNeeded.splice(tasksNeeded.indexOf(task), 1);

      if (tasksNeeded.length === 0 && !this.stopped) {
        logger.logDebug(this.logPrefix + 'every task finished', { task });
        this.meta.proposal = proposal.proposalId ?? proposal.primaryKey;
        this.emit('done', this.meta);
      }
    });

    /**
     * Emitters
     */

    if (attachments.length > 0) {
      this.emit('fetch:attachmentsFileMeta', attachments);
    } else {
      this.emit('done', this.meta);
    }
  }

  private async fetchAttachments(attachmentsFileMeta: FileMetadata[]) {
    try {
      attachmentsFileMeta.forEach(async (attachmentFileMeta) => {
        if (this.stopped) {
          this.emit('aborted', 'fetchAttachments');

          return;
        }
        const { fileId, originalFileName } = attachmentFileMeta;
        // pre-download file
        const attachmentPath = generateTmpPath();
        await services.mutations.files.prepare(fileId, attachmentPath);
        this.emit(
          'fetched:attachment',
          {
            name: originalFileName,
            path: attachmentPath,
          },
          attachmentsFileMeta
        );
      });
    } catch (e) {
      this.emit('error', e, 'fetchAttachments');
    }
  }
  private fetchAttachmentsFileMeta() {
    return async (attachments: Attachment[]) => {
      if (this.stopped) {
        this.emit('aborted', 'fetchAttachmentsFileMeta');

        return;
      }

      try {
        const filesMeta = await services.queries.files.getFileMetadata(
          [...new Set(attachments)].map(({ id }) => id)
        );
        this.emit('fetched:attachmentsFileMeta', filesMeta, attachments);
        this.emit('taskFinished', 'fetch:attachmentsFileMeta');
      } catch (e) {
        this.emit('error', e, 'fetchAttachmentsMeta');
      }
    };
  }
}

export default function newAttachmentZIPWorkflowManager(
  data: AttachmentData[]
) {
  const manager = new ZipWorkflowManager<AttachmentData, AttachmentFactoryMeta>(
    AttachmentZipFactory,
    data,
    (data) => data.proposal.primaryKey
  );

  manager.start();

  return manager;
}
