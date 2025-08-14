import { Request, Response, NextFunction } from 'express';

import startMetrics, {
  activeRequests,
  httpRequestCounter,
  httpRequestDuration,
} from './metrics';
import { MetricsService } from './MetricsService';

export class EnabledMetricsService implements MetricsService {
  constructor() {
    startMetrics();
  }

  recordRequest(req: Request, res: Response, next: NextFunction): void {
    const start = process.hrtime();
    activeRequests.add(1, { route: req.path });

    res.on('finish', () => {
      activeRequests.add(-1, { route: req.path });

      httpRequestCounter.add(1, {
        method: req.method,
        route: req.path,
        status_code: res.statusCode.toString(),
      });

      const [seconds, nanoseconds] = process.hrtime(start);
      const durationInSeconds = seconds + nanoseconds / 1e9;

      httpRequestDuration.record(durationInSeconds, {
        method: req.method,
        route: req.path,
        status_code: res.statusCode.toString(),
      });
    });

    next();
  }
}
