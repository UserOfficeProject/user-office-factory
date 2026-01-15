/* eslint-disable import/order */
import startTracing from './config/tracing';
import { logger } from '@user-office-software/duo-logger';
import app from './app';

const port = process.env.NODE_PORT || 4500;

// Global error handlers to prevent process crashes
process.on('unhandledRejection', (reason, promise) => {
  logger.logError('Unhandled Promise Rejection - process will continue', {
    reason: String(reason),
    promise: String(promise),
  });
  // Log stack trace if available
  if (reason instanceof Error && reason.stack) {
    logger.logError('Unhandled rejection stack trace', {
      stack: reason.stack,
    });
  }
});

process.on('uncaughtException', (error) => {
  logger.logException(
    'Uncaught Exception - process will attempt to continue',
    error,
    {}
  );
});

app.listen(port, () => {
  console.log(`Factory listening on http://localhost:${port}`);
});
startTracing();
