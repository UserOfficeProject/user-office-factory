import { logger } from '@user-office-software/duo-logger';
import Knex from 'knex';

const db = Knex({
  client: 'postgresql',
  connection: process.env.DATABASE_CONNECTION_STRING
    ? process.env.DATABASE_CONNECTION_STRING
    : {
        host: process.env.DATABASE_HOSTNAME,
        port: +(process.env.DATABASE_PORT as string) || 5432,
        user: process.env.DATABASE_USER,
        password: process.env.DATABASE_PASSWORD,
        database: process.env.DATABASE_DATABASE,
        timezone: 'UTC',
      },
  pool: {
    min: 0, // Knex recommended minimum
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
db.on('query-error', function (error: any, obj: any) {
  logger.logError('QUERY ERROR', { error, obj });
});

if (process.env.DATABASE_LOG_QUERIES === '1') {
  db.on('query', function ({ sql }) {
    // TODO: add timestamp to logger (maybe only ConsoleLogger needs it)
    logger.logDebug(`${new Date().toISOString()} - QUERY`, sql);
  });
}

export default db;
