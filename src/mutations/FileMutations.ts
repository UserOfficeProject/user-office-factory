import { logger } from '@esss-swap/duo-logger';

import { FileDataSource } from '../dataSources/FileDataSource';
import { FileMetadata } from '../models/File';

export default class FileMutations {
  constructor(private dataSource: FileDataSource) {}

  async put(
    fileName: string,
    mimeType: string,
    sizeImBytes: number,
    path: string
  ): Promise<FileMetadata> {
    return this.dataSource
      .put(fileName, mimeType, sizeImBytes, path)
      .then(metadata => metadata)
      .catch(err => {
        logger.logException('Could not save file', err, { fileName, path });

        throw 'INTERNAL_ERROR';
      });
  }

  async prepare(fileId: string, filePath: string): Promise<string> {
    return this.dataSource
      .prepare(fileId, filePath)
      .then(() => filePath)
      .catch(err => {
        logger.logException('Could not prepare file', err, { fileId });

        throw 'INTERNAL_ERROR';
      });
  }
}
