import {
  Winston,
  WinstonLogger,
  setLogger,
} from '@user-office-software/duo-logger';

import OpentelemetryLogTransport from './opentelemetryLogTransport';

export function configureSTFCWinstonLogger() {
  const transports: Winston.transport[] = [new Winston.transports.Console()];
  if (!!process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT) {
    transports.push(new OpentelemetryLogTransport());
  }

  setLogger(
    new WinstonLogger({
      format: Winston.format.combine(
        Winston.format.timestamp({
          format: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
        }),
        Winston.format.printf((args) => {
          return `[${args.timestamp}] ${args.level.toUpperCase()} - ${args.message} \n ${JSON.stringify(args)}`;
        })
      ),
      transports,
    })
  );
}
