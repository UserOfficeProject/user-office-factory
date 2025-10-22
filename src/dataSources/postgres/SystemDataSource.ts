import { logger } from '@user-office-software/duo-logger';

import database from './database';
import { SystemDataSource } from '../SystemDataSource';

export default class PostgresSystemDataSource implements SystemDataSource {
  async connectivityCheck(): Promise<boolean> {
    try {
      await database.raw('select 1');

      return true;
    } catch (error) {
      logger.logError('Connection not ready yet', { error });

      return false;
    }
  }
}
