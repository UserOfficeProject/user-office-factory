import 'dotenv/config';

import { readFile } from 'fs';
import { join } from 'path';

import { logger } from '@user-office-software/duo-logger';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import createError, { HttpError } from 'http-errors';
import httpLogger from 'morgan';
import './services';
import './config';
import { container } from 'tsyringe';

import { MetricsService } from './config/metrics/MetricsService';
import { Tokens } from './config/Tokens';
import PostgresSystemDataSource from './dataSources/postgres/SystemDataSource';
import { browserConnected } from './pdf';
import { renderTemplate } from './template';
import getPDFWorkflowManager from './workflows/pdf';
import { WorkflowManager } from './workflows/WorkflowManager';
import getXLSXWorkflowManager from './workflows/xlsx';
import getZIPWorkflowManager from './workflows/zip';

const app = express();
const systemDataSource = new PostgresSystemDataSource();
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
app.use('/static', cors(), express.static(join(__dirname, '..', 'templates')));

const metricsService = container.resolve<MetricsService>(
  Tokens.ConfigureMetrics
);
app.use((req, res, next) => metricsService.recordRequest(req, res, next));

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
      case 'zip':
        manager = getZIPWorkflowManager(type, req.body);
        break;
      default:
        return next(new Error(`Unknown 'downloadType': ${downloadType}`));
    }

    manager.onError((e) => next(e));

    manager.onTaskFinished((rs) => {
      if (req.aborted || rs.destroyed || res.destroyed) {
        return;
      }
      res.setHeader('content-type', manager.responseHeader.MIME_TYPE);
      if (manager.responseHeader.CONTENT_DISPOSITION) {
        res.setHeader(
          'content-disposition',
          manager.responseHeader.CONTENT_DISPOSITION
        );
      }
      rs.pipe(res);
    });

    res.once('close', () => {
      if (res.writableEnded) {
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

app.get('/readiness', async (req, res) => {
  const browserStatus = await browserConnected();
  const systemDatabaseStatus = await systemDataSource.connectivityCheck();
  if (systemDatabaseStatus) {
    return res.status(200).json({
      status: 'Up',
      puppeteer: 'Connected',
      database: 'Connected',
    });
  }

  return res.status(500).json({
    status: 'Down',
    puppeteer: browserStatus ? 'Connected' : 'Not connected',
    database: systemDatabaseStatus ? 'Connected' : 'Not connected',
  });
});

app.get(['/', '/health-check'], (req, res) => {
  res.json({ message: 'Up and running ヾ(￣▽￣) ' });
});

app.get('/favicon.ico', (req, res) => res.end());

app.get('/fonts/segoeui', cors(), (req: Request, res: Response) => {
  const port = process.env.NODE_PORT || 4500;
  const font = `@font-face {
    font-family: SegoeUI;
    src: url(http://localhost:${port}/static/fonts/segoe-ui/segoeui-light.ttf)
        format('truetype');
    font-weight: 100;
  }
  @font-face {
    font-family: SegoeUI;
    src: url(http://localhost:${port}/static/fonts/segoe-ui/segoeui-semi-light.ttf)
        format('truetype');
    font-weight: 200;
  }
  @font-face {
    font-family: SegoeUI;
    src: url(http://localhost:${port}/static/fonts/segoe-ui/segoeui-normal.ttf)
        format('truetype');
    font-weight: 400;
  }
  @font-face {
    font-family: SegoeUI;
    src: url(http://localhost:${port}/static/fonts/segoe-ui/segoeui-bold.ttf)
        format('truetype');
    font-weight: 600;
  }
  @font-face {
    font-family: SegoeUI;
    src: url(http://localhost:${port}/static/fonts/segoe-ui/segoeui-semi-bold.ttf)
        format('truetype');
    font-weight: 700;
  }
  @font-face {
    font-family: SegoeUI;
    src: url(http://localhost:${port}/static/fonts/segoe-ui/segoeuii.ttf)
        format('truetype');
    font-style: italic;
  }
  @font-face {
    font-family: SegoeUI;
    src: url(http://localhost:${port}/static/fonts/segoe-ui/segoeuiz.ttf)
        format('truetype');
    font-weight: 600;
    font-style: italic;
  }
  `;
  res.write(font);
  res.end();
});

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

container.resolve<(() => void) | undefined>(Tokens.ConfigureLogger)?.();

export default app;
