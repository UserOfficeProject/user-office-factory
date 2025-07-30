import 'reflect-metadata';
import { configureGraylogLogger } from './ess/configureGrayLogLogger';
import { DisabledMetricsService } from './metrics/DisabledMetricsService';
import { Tokens } from './Tokens';
import { mapValue } from './utils';

mapValue(Tokens.ConfigureLogger, configureGraylogLogger);
mapValue(Tokens.ConfigureMetrics, new DisabledMetricsService());
