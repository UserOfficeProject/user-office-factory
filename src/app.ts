import 'dotenv/config';

import { join } from 'path';

import { logger } from '@esss-swap/duo-logger';
import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import createError, { HttpError } from 'http-errors';
import httpLogger from 'morgan';

import { renderTemplate } from './template';
import generatePdf from './workflows';

import './services';

const app = express();

app.use(httpLogger('tiny'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/static', express.static(join(__dirname, '..', 'templates')));

app.post('/generate-pdf/:type', (req, res, next) => {
  const { type } = req.params;
  generatePdf(type, req.body)
    .then(rs => {
      res.setHeader('content-type', 'application/pdf');
      rs.pipe(res);
    })
    .catch(err => next(err));
});

app.get('/test-template/:template', (req, res, next) => {
  const { template } = req.params;
  const { data } = req.query;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  renderTemplate(template as any, {
    ...JSON.parse(Buffer.from(data as string, 'base64').toString()),
  })
    .then(html => {
      res.write(html);
      res.end();
    })
    .catch(e => next(e));
});

app.get('/', (req, res) => {
  res.json({ message: 'Up and running ヾ(￣▽￣) ' });
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(
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
