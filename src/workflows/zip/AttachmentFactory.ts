import EventEmitter from 'events';

import { logger } from '@user-office-software/duo-logger';

import { failSafeDeleteFiles } from '../../util/fileSystem';

type Files = { name: string; path: string };
export type AttachmentFactoryMeta = {
  proposal: string;
  files: Files[];
};

export default abstract class ZipFactory<
  TData,
  TAttachmentFactoryMeta extends AttachmentFactoryMeta,
> extends EventEmitter {
  static ENTITY_NAME: string;

  protected entityId: number;
  protected stopped = false;
  protected aborted = false;

  protected abstract meta: TAttachmentFactoryMeta;

  abstract init(params: TData): void;

  get logPrefix() {
    const entityName = (this.constructor as typeof ZipFactory).ENTITY_NAME;

    return `[${this.constructor.name}] ${entityName}, ${this.entityId}: `;
  }

  constructor(entityId: number) {
    super();

    this.entityId = entityId;
    this.on('aborted', (action, ctx: Record<string, unknown>) => {
      logger.logWarn(this.logPrefix + `${action} was aborted`, { ...ctx });
    });

    this.on('error', (err, source, context) => {
      logger.logException(this.logPrefix + 'had unexpected error', err, {
        source,
        context,
      });

      // `abort` is called by ZipWorkflowManager
      this.stopped = true;
    });
  }

  onceError(cb: (err: Error) => void) {
    this.once('error', cb);
  }

  onceDone(cb: (meta: TAttachmentFactoryMeta) => void) {
    this.once('done', cb);
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

    this.meta.files.forEach((file) => {
      if (!file) {
        return;
      }
      failSafeDeleteFiles([file.path]);
    });
  }
}
