import { logger } from '@user-office-software/duo-logger';

import database from './database';
import { SystemDataSource } from '../SystemDataSource';

export default class PostgresSystemDataSource implements SystemDataSource {
  async connectivityCheck(): Promise<boolean> {
    try {
      return database
        .raw('select * FROM "files" LIMIT 1')
        .then(() => {
          return true;
        })
        .catch((error) => {
          logger.logInfo('Connection not ready yet', { error });

          return false;
        });
    } catch (error) {
      logger.logInfo('Connection not ready yet', { error });

      return false;
    }
  }
}
