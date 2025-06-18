import { logger } from '@user-office-software/duo-logger';
import 'reflect-metadata';

switch (process.env.DEPENDENCY_CONFIG) {
  case 'ess':
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./dependencyConfigESS');
    break;
  case 'stfc':
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./dependencyConfigSTFC');
  default:
    logger.logInfo(
      'Invalid or no value was provided for the DEPENDENCY_CONFIG. Using the default config',
      { DEPENDENCY_CONFIG: process.env.DEPENDENCY_CONFIG }
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('./dependencyConfigDefault');
}

export {};
