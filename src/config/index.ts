import { logger } from '@user-office-software/duo-logger';
import 'reflect-metadata';

switch (process.env.DEPENDENCY_CONFIG) {
  case 'ess':
    require('./dependencyConfigESS');
    break;
  default:
    logger.logInfo(
      'Invalid or no value was provided for the DEPENDENCY_CONFIG. Using the default config',
      { DEPENDENCY_CONFIG: process.env.DEPENDENCY_CONFIG }
    );

    require('./dependencyConfigDefault');
}

export {};
