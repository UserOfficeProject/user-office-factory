import 'dotenv/config';

import { readFile } from 'fs';
import { join } from 'path';

import { logger } from '@user-office-software/duo-logger';
import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import createError, { HttpError } from 'http-errors';
import httpLogger from 'morgan';

import './services';
import { renderTemplate } from './template';
import getPDFWorkflowManager from './workflows/pdf';
import { WorkflowManager } from './workflows/WorkflowManager';
import getXLSXWorkflowManager from './workflows/xlsx';

const app = express();

app.use(
  httpLogger('tiny', {
    skip: function (req, res) {
      // skip health check and static requests from logs
      return (
        (req.path === '/health-check' || req.baseUrl.startsWith('/static')) &&
        res.statusCode < 400
      );
    },
  })
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/static', express.static(join(__dirname, '..', 'templates')));

app.post(
  '/generate/:downloadType/:type',
  (req: Request, res: Response, next) => {
    const { type, downloadType } = req.params;

    let manager: WorkflowManager;
    switch (downloadType) {
      case 'pdf':
        manager = getPDFWorkflowManager(type, req.body);
        break;
      case 'xlsx':
        manager = getXLSXWorkflowManager(type, req.body);
        break;
      default:
        return next(new Error(`Unknown 'downloadType': ${downloadType}`));
    }

    manager.onError((e) => next(e));

    manager.onTaskFinished((rs) => {
      if (req.aborted || req.destroyed) {
        return;
      }

      res.setHeader('content-type', manager.MIME_TYPE);
      rs.pipe(res);
    });

    req.once('close', () => {
      if (res.finished) {
        return;
      }

      /**
       * if the request was closed before we finished writing
       * assume the request was aborted
       */
      manager.abort();
    });
  }
);

app.get('/test-template/:template', (req, res, next) => {
  const { template } = req.params;
  const { data } = req.query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderTemplate(template as any, {
    ...JSON.parse(Buffer.from(data as string, 'base64').toString()),
  })
    .then((html) => {
      res.write(html);
      res.end();
    })
    .catch((e) => next(e));
});

let cachedVersion: string;

app.get('/version', (req, res) => {
  if (cachedVersion) {
    return res.end(cachedVersion);
  }

  readFile(join(process.cwd(), 'build-version.txt'), (err, content) => {
    if (err) {
      if (err.code !== 'ENOENT') {
        logger.logException(
          'Unknown error while reading build-version.txt',
          err
        );
      }

      return res.end('<unknown>');
    }

    cachedVersion = content.toString().trim();

    res.end(cachedVersion);
  });
});

app.get(['/', '/health-check'], (req, res) => {
  res.json({ message: 'Up and running ヾ(￣▽￣) ' });
});

app.get('/favicon.ico', (req, res) => res.end());

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (
  err: HttpError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) {
  const errorMessage = {
    message: err.message,
    error: {
      message: err.message,
      stack: err.stack?.toString() || '',
    },
  };

  logger.logError('Factory: request failed', { error: errorMessage });

  // render the error page
  res.status(err.status || 500);
  res.json(errorMessage);
});

export default app;
