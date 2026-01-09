import { Request, Response, NextFunction } from 'express';

export interface MetricsService {
  recordRequest(req: Request, res: Response, next: NextFunction): void;
}
