import { randomBytes } from 'crypto';
import { mkdtempSync, unlink } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { logger } from '@esss-swap/duo-logger';

const tmpDir = mkdtempSync(join(tmpdir(), 'user-office-'));

logger.logDebug('Temporary directory created: ', { tmpDir });

export function generateTmpPath() {
  const name = `${Date.now()}-${randomBytes(6).toString('hex')}`;

  return join(tmpDir, `${name}`);
}

export function failSafeDeleteFiles(filePaths: string[]) {
  filePaths.forEach(filePath =>
    unlink(filePath, err => {
      if (!err) {
        return;
      }

      logger.logException('[failSafeDeleteFiles] Failed to delete file', err, {
        filePath,
      });
    })
  );
}
