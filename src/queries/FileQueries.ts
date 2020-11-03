import { FileDataSource } from '../dataSources/FileDataSource';

export default class FileQueries {
  constructor(private fileDataSource: FileDataSource) {}

  async getFileMetadata(fileIds: string[], filter?: { mimeType?: string }) {
    // TODO There should be authentification

    return this.fileDataSource.getMetadata(fileIds, filter);
  }
}
