import { ReadStream, createReadStream } from 'fs';
import { Readable } from 'stream';

import { logger } from '@esss-swap/duo-logger';

import { WorkflowManager } from '../WorkflowManager';
import PdfFactory, {
  PdfFactoryMeta,
  PdfFactoryCountedPagesMeta,
} from './PdfFactory';

// FIXME
type Constructable<T> = {
  new (...args: any[]): T;
};

type FactoryMeta = {
  meta: PdfFactoryMeta;
  metaCountedPages: PdfFactoryCountedPagesMeta;
};

export default class PdfWorkflowManager<
  TFactoryData,
  TFactory extends PdfFactory<TFactoryData>
> extends WorkflowManager {
  protected data: TFactoryData[];
  protected factories: TFactory[];
  protected factoriesMeta: Map<number, FactoryMeta> = new Map();

  constructor(factory: Constructable<TFactory>, data: TFactoryData[]) {
    super();

    this.data = data;

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      const inst = new factory();

      inst.once('error', err => this.ee.emit('error', err));
      inst.once('done', (meta, metaCountedPages) => {
        this.factoriesMeta.set(i, { meta, metaCountedPages });
        this.ee.emit('pdfCreated');
      });

      this.factories.push(inst);
      inst.init(d);
    }

    this.setupListeners();
  }

  private setupListeners() {
    // If there were more than one errors keep logging them
    this.ee.on('error', () => {
      // FIXME
    });

    // if we encountered an error, we finished or were canceled
    // try to stop any ongoing work and clean things up
    this.ee.once('error', () =>
      this.factories.forEach(factory => factory.emit('cleanup'))
    );
    this.ee.once('cleanup', () =>
      this.factories.forEach(factory => factory.emit('cleanup'))
    );

    this.ee.on('pdfCreated', () => {
      if (this.factoriesMeta.size === this.data.length) {
        this.finalizePDF();
      }
    });
  }

  private finalizePDF() {
    /**
     do things ...
     do things ...
     do things ...
     */

    // TODO
    this.taskFinished();
  }

  private responseRS: ReadStream | null = null;

  private taskFinished() {
    this.responseRS = createReadStream('');
    this.responseRS.on('error', err => this.ee.emit('error', err));
    this.responseRS.once('close', () => {
      // TODO: clear
    });

    this.ee.emit('taskFinished');
  }

  onError(cb: (err: Error) => void): void {
    this.ee.once('error', err => cb(err));
  }

  onTaskFinished(cb: (rs: Readable) => void): void {
    this.ee.once('taskFinished', () => {
      if (this.responseRS === null) {
        this.ee.emit('error', 'task finished without creating responseRS');

        return;
      }

      cb(this.responseRS);
    });
  }

  cancelTasks(): void {
    this.ee.emit('cleanup');
    if (this.responseRS !== null) {
      this.responseRS.destroy();
    }
  }
}
