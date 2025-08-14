import 'reflect-metadata';
import { DisabledMetricsService } from './metrics/DisabledMetricsService';
import { EnabledMetricsService } from './metrics/EnabledMetricsService';
import { configureSTFCWinstonLogger } from './stfc/configureSTFCWinstonLogger';
import { Tokens } from './Tokens';
import { mapValue } from './utils';

function resolveMetricsService() {
  return process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT
    ? new EnabledMetricsService()
    : new DisabledMetricsService();
}

mapValue(Tokens.ConfigureLogger, configureSTFCWinstonLogger);
mapValue(Tokens.ConfigureMetrics, resolveMetricsService());
