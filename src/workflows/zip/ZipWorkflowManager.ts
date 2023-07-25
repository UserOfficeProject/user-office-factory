import { ReadStream, createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

import { logger } from '@user-office-software/duo-logger';
import archiver from 'archiver';

import AttachmentFactory, { AttachmentFactoryMeta } from './AttachmentFactory';
import { failSafeDeleteFiles, generateTmpPath } from '../../util/fileSystem';
import { ResponseHeader, WorkflowManager } from '../WorkflowManager';

type Constructable<T> = {
  new (entityId: number): T;
};
type FactoryMeta<TZipFactoryMeta extends AttachmentFactoryMeta> = {
  meta: TZipFactoryMeta;
};

type FactoryGenerator<
  TFactoryData,
  TVFactoryMeta extends AttachmentFactoryMeta
> = Constructable<AttachmentFactory<TFactoryData, TVFactoryMeta>>;

export default class ZipWorkflowManager<
  TFactoryData,
  TZipFactoryMeta extends AttachmentFactoryMeta
> extends WorkflowManager {
  protected data: TFactoryData[];
  protected entityIds: number[] = [];
  protected factories: AttachmentFactory<TFactoryData, TZipFactoryMeta>[] = [];
  protected factoriesMeta: Map<number, FactoryMeta<TZipFactoryMeta>> =
    new Map();

  private responseRS: ReadStream | null = null;

  get responseHeader(): ResponseHeader {
    return {
      MIME_TYPE: 'application/zip',
      CONTENT_DISPOSITION: 'attachment; filename=attachments.zip',
    };
  }

  get logPrefix() {
    return `[${this.constructor.name}] `;
  }

  constructor(
    factory: FactoryGenerator<TFactoryData, TZipFactoryMeta>,
    data: TFactoryData[],
    extractEntityId: (data: TFactoryData) => number
  ) {
    super();

    if (!data) {
      throw new Error('There is no data to process');
    }
    this.data = [...data];

    for (let i = 0; i < this.data.length; i++) {
      const entityId = extractEntityId(this.data[i]);

      const inst = new factory(entityId);

      this.entityIds.push(entityId);

      inst.onceError((err) => this.ee.emit('error', err));
      inst.onceDone((meta) => {
        this.factoriesMeta.set(i, { meta });
        this.ee.emit('entityExecutionFinished');
      });

      this.factories.push(inst);
    }

    this.setupListeners();
  }
  start() {
    for (let i = 0; i < this.data.length; i++) {
      this.factories[i].init(this.data[i]);
    }
  }

  onError(cb: (err: Error) => void): void {
    this.ee.once('error', (err) => cb(err));
  }

  onTaskFinished(cb: (rs: Readable) => void): void {
    this.ee.once('taskFinished', () => {
      if (this.responseRS === null) {
        this.ee.emit('error', 'Task finished without creating `responseRS`');

        return;
      }

      cb(this.responseRS);
    });
  }

  abort(): void {
    this.ee.emit('abort');
    if (this.responseRS !== null) {
      this.responseRS.destroy();
      this.responseRS = null;
    }
  }

  private setupListeners() {
    // If there were more than one errors keep logging them
    this.ee.on('error', (err) => {
      logger.logException(this.logPrefix + 'had error', err, {});
    });

    // if we encountered an error, we finished or were aborted
    // try to stop any ongoing work and clean things up
    this.ee.once('error', () =>
      this.factories.forEach((factory) => factory.abort())
    );
    this.ee.once('abort', () =>
      this.factories.forEach((factory) => factory.abort())
    );
    this.ee.once('taskFinished', () =>
      this.factories.forEach((factory) => factory.cleanup())
    );
    this.ee.on('entityExecutionFinished', async () => {
      if (this.factoriesMeta.size === this.data.length) {
        await this.createZipFile()
          .then((zipPath) => this.taskFinished(zipPath))
          .catch((error) => this.ee.emit('error', error));
      }
    });
  }
  private createZipFile() {
    const outPath = `${generateTmpPath()}.zip`;
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = createWriteStream(outPath);

    return new Promise<string>(async (resolve, reject) => {
      stream.on('close', () => {
        logger.logDebug(
          `${
            this.logPrefix
          } zip file has been finalized and is ${archive.pointer()} total bytes`,
          {}
        );
      });
      archive.on('error', (err) => {
        return reject(err);
      });
      for (let rootIdx = 0; rootIdx < this.data.length; rootIdx++) {
        if (!this.factoriesMeta.has(rootIdx)) {
          logger.logError(
            this.logPrefix + `'${rootIdx}' is missing from 'factoriesMeta'`,
            {
              factoriesMeta: this.factoriesMeta,
            }
          );

          throw new Error(`'${rootIdx}' is missing from 'factoriesMeta'`);
        }

        const { meta } = this.factoriesMeta.get(rootIdx)!;
        for (const file of meta.files) {
          archive.file(file.path, {
            name: `/${meta.proposal}/${file.name}`,
          });
        }
      }
      archive.pipe(stream);
      stream.on('close', () => {
        return resolve(outPath);
      });
      archive.finalize();
    });
  }

  private taskFinished(zipFilePath: string) {
    this.responseRS = createReadStream(zipFilePath);
    this.responseRS.on('error', (err) => this.ee.emit('error', err));
    this.responseRS.once('close', () => failSafeDeleteFiles([zipFilePath]));

    this.ee.emit('taskFinished');
  }
}
