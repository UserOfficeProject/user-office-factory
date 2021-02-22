import { Readable } from 'stream';

import { WorkflowManager } from '../WorkflowManager';

export default class XLSXWorkflowManager extends WorkflowManager {
  // https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types/Common_types
  get MIME_TYPE() {
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  }

  private cbOnError: (e: Error) => void;
  private cbOnTaskFinished: (rs: Readable) => void;

  constructor(fn: () => Promise<Readable>) {
    super();

    fn()
      .then(rs => this.cbOnTaskFinished(rs))
      .catch(err => this.cbOnError(err));
  }

  onError(cb: (e: Error) => void): void {
    this.cbOnError = cb;
  }

  onTaskFinished(cb: (rs: Readable) => void): void {
    this.cbOnTaskFinished = cb;
  }

  abort(): void {
    // no-op
  }
}
