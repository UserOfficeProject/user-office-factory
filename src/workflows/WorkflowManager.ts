import { EventEmitter } from 'events';
import { Readable } from 'stream';

export abstract class WorkflowManager {
  protected ee = new EventEmitter();

  abstract onError(cb: (e: Error) => void): void;

  abstract onTaskFinished(cb: (rs: Readable) => void): void;

  abstract cancelTasks(): void;
}
