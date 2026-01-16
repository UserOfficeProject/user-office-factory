import { randomBytes } from 'crypto';
import { access, constants, mkdtempSync, unlink } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { logger } from '@user-office-software/duo-logger';

const tmpDir = mkdtempSync(join(tmpdir(), 'user-office-'));

logger.logDebug('Temporary directory created: ', { tmpDir });

export function generateTmpPath() {
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}`;

  return join(tmpDir, `${name}`);
}

export function generateTmpPathWithName(name: string) {
  return join(tmpDir, `${name}`);
}

export function failSafeDeleteFiles(filePaths: string[]) {
  filePaths.forEach((filePath) => {
    if (typeof filePath === 'string' && filePath.trim()) {
      access(filePath, constants.F_OK, (accessErr) => {
        if (accessErr) {
          // File does not exist, nothing to delete.
          // This can happen when a task is aborted before it creates any files.
          // In that case, we simply skip deletion.
          return;
        }

        unlink(filePath, (err) => {
          if (!err) {
            return;
          }

          logger.logException(
            `[failSafeDeleteFiles] Failed to delete file ${filePath}`,
            err,
            {
              filePath,
            }
          );
        });
      });
    }
  });
}
