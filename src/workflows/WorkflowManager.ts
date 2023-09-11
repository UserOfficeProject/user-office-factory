import { EventEmitter } from 'events';
import { Readable } from 'stream';
export type ResponseHeader = {
  MIME_TYPE: string;
  CONTENT_DISPOSITION: string;
};

export abstract class WorkflowManager {
  abstract get responseHeader(): ResponseHeader;

  protected ee = new EventEmitter();

  abstract onError(cb: (e: Error) => void): void;

  abstract onTaskFinished(cb: (rs: Readable) => void): void;

  abstract abort(): void;
}
