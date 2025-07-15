import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-proto';
import { HostMetrics } from '@opentelemetry/host-metrics';
import { envDetector, processDetector } from '@opentelemetry/resources';
import { detectResources } from '@opentelemetry/resources';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';

const exporter = new OTLPMetricExporter({
  url: 'http://alloy:4318/v1/metrics',
});

diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);

const reader = new PeriodicExportingMetricReader({
  exporter,
  exportIntervalMillis: 10000,
});

const customResource = detectResources({
  detectors: [envDetector, processDetector],
});

customResource.attributes['service.name'] = 'user-office-factory-app';

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
hostMetrics.start();
