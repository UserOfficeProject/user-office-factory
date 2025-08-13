import { Request, Response, NextFunction } from 'express';

import { MetricsService } from './MetricsService';

export class DisabledMetricsService implements MetricsService {
  recordRequest(req: Request, res: Response, next: NextFunction): void {
    next(); // No-op
  }
}
