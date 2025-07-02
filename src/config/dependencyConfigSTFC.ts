import 'reflect-metadata';
import { configureSTFCWinstonLogger } from './stfc/configureSTFCWinstonLogger';
import { Tokens } from './Tokens';
import { mapValue } from './utils';

mapValue(Tokens.ConfigureLogger, configureSTFCWinstonLogger);
