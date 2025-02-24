import 'reflect-metadata';
import { configureGraylogLogger } from './ess/configureGrayLogLogger';
import { Tokens } from './Tokens';
import { mapValue } from './utils';

mapValue(Tokens.ConfigureLogger, configureGraylogLogger);
