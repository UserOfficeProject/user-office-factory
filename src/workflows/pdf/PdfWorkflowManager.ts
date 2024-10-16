import { ReadStream, createReadStream, createWriteStream } from 'fs';
import { Readable } from 'stream';

import { logger } from '@user-office-software/duo-logger';
import archiver from 'archiver';

import PdfFactory, {
  PdfFactoryMeta,
  PdfFactoryCountedPagesMeta,
  PdfFactoryPicker,
} from './PdfFactory';
import {
  TableOfContents,
  mergePDF,
  writeToC,
  writeToCWithName,
} from '../../pdf';
import { Role } from '../../types';
import { failSafeDeleteFiles, generateTmpPath } from '../../util/fileSystem';
import { ResponseHeader, WorkflowManager } from '../WorkflowManager';

type Constructable<T> = {
  new (entityId: number, userRole: Role): T;
};

type FactoryMeta<TPdfFactoryMeta extends PdfFactoryMeta> = {
  meta: TPdfFactoryMeta;
  metaCountedPages: PdfFactoryCountedPagesMeta<TPdfFactoryMeta>;
};

type FinalizePdfHandler<
  TFactoryData,
  TPdfFactoryMeta extends PdfFactoryMeta,
> = (
  params: {
    rootToC: TableOfContents[];
    filePaths: string[];
    data: TFactoryData;
    pageNumber: number;
  } & FactoryMeta<TPdfFactoryMeta>
) => number /* pageNumber */;

type FinalizePdfNameHandler<TFactoryData> = (params: {
  data: TFactoryData;
}) => string /* fileName */;

type FinalizeDownloadTypeHandler = () => boolean;

type FactoryGenerator<TFactoryData, TPdfFactoryMeta extends PdfFactoryMeta> =
  | Constructable<PdfFactory<TFactoryData, TPdfFactoryMeta>>
  | PdfFactoryPicker<TFactoryData, TPdfFactoryMeta>;

type Files = { name: string; path: string };

export default class PdfWorkflowManager<
  TFactoryData,
  TPdfFactoryMeta extends PdfFactoryMeta,
> extends WorkflowManager {
  protected data: TFactoryData[];
  protected entityIds: number[] = [];
  protected factories: PdfFactory<TFactoryData, TPdfFactoryMeta>[] = [];
  protected factoriesMeta: Map<number, FactoryMeta<TPdfFactoryMeta>> =
    new Map();

  private responseRS: ReadStream | null = null;
  // callback used in `finalizePDF`
  private cbFinalizePdf: FinalizePdfHandler<
    TFactoryData,
    TPdfFactoryMeta
  > | null = null;

  private cbFinalizePdfName: FinalizePdfNameHandler<TFactoryData> | null = null;
  private cbFinalizeDownloadType: FinalizeDownloadTypeHandler | null = null;

  get responseHeader(): ResponseHeader {
    if (this.cbFinalizeDownloadType !== null && this.cbFinalizeDownloadType()) {
      return {
        MIME_TYPE: 'application/zip',
        CONTENT_DISPOSITION: 'attachment; filename=proposals.zip',
      };
    } else {
      return {
        MIME_TYPE: 'application/pdf',
        CONTENT_DISPOSITION: '',
      };
    }
  }

  get logPrefix() {
    return `[${this.constructor.name}] `;
  }

  constructor(
    factory: FactoryGenerator<TFactoryData, TPdfFactoryMeta>,
    data: TFactoryData[],
    extractEntityId: (data: TFactoryData) => number,
    userRole: Role
  ) {
    super();

    this.data = data;

    for (let i = 0; i < data.length; i++) {
      const entityId = extractEntityId(this.data[i]);

      let inst;
      if (factory instanceof PdfFactoryPicker) {
        inst = factory.getFactory(this.data[i], entityId, userRole);
      } else {
        inst = new factory(entityId, userRole);
      }

      this.entityIds.push(entityId);

      inst.onceError((err) => this.ee.emit('error', err));
      inst.onceDone((meta, metaCountedPages) => {
        this.factoriesMeta.set(i, { meta, metaCountedPages });
        this.ee.emit('pdfCreated');
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

    this.ee.on('pdfCreated', () => {
      if (this.factoriesMeta.size === this.data.length) {
        this.finalizePDF();
      }
    });
  }

  onFinalizePDF(
    cbFinalizePdf: FinalizePdfHandler<TFactoryData, TPdfFactoryMeta>
  ) {
    this.cbFinalizePdf = cbFinalizePdf;
  }

  onFinalizeFileName(cbFinalizePdfName: FinalizePdfNameHandler<TFactoryData>) {
    this.cbFinalizePdfName = cbFinalizePdfName;
  }

  onFinalizeDownloadType(cbFinalizeDownloadType: FinalizeDownloadTypeHandler) {
    this.cbFinalizeDownloadType = cbFinalizeDownloadType;
  }

  private finalizePDF() {
    logger.logDebug(this.logPrefix + 'Finalizing PDF', {
      ids: this.entityIds,
    });

    if (this.cbFinalizeDownloadType !== null && this.cbFinalizeDownloadType()) {
      const files: Files[] = [];
      for (let rootIdx = 0; rootIdx < this.data.length; rootIdx++) {
        const filePaths: string[] = [];

        const rootToC: TableOfContents[] = [];
        let pageNumber = 0;

        if (this.cbFinalizePdf === null) {
          throw new Error('`cbFinalizePdf` is not defined!');
        }

        if (!this.factoriesMeta.has(rootIdx)) {
          logger.logError(
            this.logPrefix + `'${rootIdx}' is missing from 'factoriesMeta'`,
            {
              factoriesMeta: this.factoriesMeta,
            }
          );
          throw new Error(`'${rootIdx}' is missing from 'factoriesMeta'`);
        }

        const { meta, metaCountedPages } = this.factoriesMeta.get(rootIdx)!;
        const item = this.data[rootIdx];

        pageNumber = this.cbFinalizePdf({
          rootToC,
          filePaths,
          meta,
          metaCountedPages,
          data: item,
          pageNumber,
        });

        if (this.cbFinalizePdfName === null) {
          throw new Error('`cbFinalizePdfName` is not defined!');
        }

        const fileName = this.cbFinalizePdfName({ data: item });

        const mergedPdfPath = mergePDF(filePaths);
        const pdfWithToCPath = writeToCWithName(
          mergedPdfPath,
          rootToC,
          fileName
        );
        const file: Files = {
          name: fileName,
          path: pdfWithToCPath,
        };
        files.push(file);
      }
      this.createZipFile(files)
        .then((zipPath) => this.taskFinished(zipPath))
        .catch((error) => this.ee.emit('error', error));
    } else {
      const filePaths: string[] = [];

      const rootToC: TableOfContents[] = [];
      let pageNumber = 0;

      if (this.cbFinalizePdf === null) {
        throw new Error('`cbFinalizePdf` is not defined!');
      }

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

        const { meta, metaCountedPages } = this.factoriesMeta.get(rootIdx)!;
        const item = this.data[rootIdx];

        pageNumber = this.cbFinalizePdf({
          rootToC,
          filePaths,
          meta,
          metaCountedPages,
          data: item,
          pageNumber,
        });
      }

      const mergedPdfPath = mergePDF(filePaths);
      const pdfWithToCPath = writeToC(mergedPdfPath, rootToC);

      failSafeDeleteFiles([mergedPdfPath]);

      logger.logDebug(this.logPrefix + 'PDF merged', {
        pdfWithToCPath,
        ids: this.entityIds,
      });

      this.taskFinished(pdfWithToCPath);
    }
  }

  private createZipFile(fileList: Files[]) {
    const outPath = `${generateTmpPath()}.zip`;
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = createWriteStream(outPath);

    return new Promise<string>(async (resolve, reject) => {
      archive.on('error', (err) => {
        return reject(err);
      });

      fileList.forEach((file) => {
        archive.file(file.path, {
          name: file.name,
        });
      });

      archive.pipe(stream);
      stream.on('close', () => {
        logger.logDebug(
          `${
            this.logPrefix
          } zip file has been finalized and is ${archive.pointer()} total bytes`,
          {}
        );

        return resolve(outPath);
      });
      archive.finalize();
    });
  }

  private taskFinished(pdfWithToCPath: string) {
    this.responseRS = createReadStream(pdfWithToCPath);
    this.responseRS.on('error', (err) => this.ee.emit('error', err));
    this.responseRS.once('close', () => failSafeDeleteFiles([pdfWithToCPath]));

    this.ee.emit('taskFinished');
  }
}
