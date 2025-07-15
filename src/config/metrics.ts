//import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'; //Enable for debug-level diagnostics logging.
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { envDetector, processDetector } from '@opentelemetry/resources';
import { detectResources } from '@opentelemetry/resources';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { logger } from '@user-office-software/duo-logger';

const exporter = new OTLPMetricExporter({
  url: process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT,
});

//diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG); //Enable for debug-level diagnostics logging.

const reader = new PeriodicExportingMetricReader({
  exporter,
  exportIntervalMillis: 10000,
});

const customResource = detectResources({
  detectors: [envDetector, processDetector],
});

customResource.attributes['service.name'] =
  process.env.OTEL_SERVICE_NAME || 'user-office-factory-app';

const meterProvider = new MeterProvider({
  resource: customResource,
  readers: [reader],
});

export const meter = meterProvider.getMeter('user-office-factory-app');

export const httpRequestCounter = meter.createCounter('http_requests_total', {
  description:
    'Total number of HTTP requests by method, route, and status code',
});

export const httpRequestDuration = meter.createHistogram(
  'http_request_duration_seconds',
  {
    description: 'Duration of HTTP requests in seconds',
  }
);

export const activeRequests = meter.createUpDownCounter(
  'http_active_requests',
  {
    description: 'Number of active HTTP requests',
  }
);

const hostMetrics = new HostMetrics({ meterProvider });

export function isMetricsEnabled(): boolean {
  return !!process.env.OTEL_EXPORTER_OTLP_METRICS_ENDPOINT;
}

export default async function startMetrics() {
  if (isMetricsEnabled()) {
    logger.logInfo('Metrics initializing', {});
    hostMetrics.start();
  } else {
    logger.logInfo('Metrics not enabled. Skipping initialization.', {});
  }
}
