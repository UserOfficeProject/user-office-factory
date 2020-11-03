import 'dotenv/config';

import { join } from 'path';

import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import createError, { HttpError } from 'http-errors';
import logger from 'morgan';

import { renderTemplate } from './template';
import generatePdf from './workflows';

import './services';

const app = express();

app.use(logger('tiny'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/static', express.static(join(__dirname, '..', 'templates')));

app.post('/generate-pdf/:type', (req, res, next) => {
  const { type } = req.params;
  generatePdf(type, req.body)
    .then(rs => rs.pipe(res))
    .catch(err => next(err));
});

app.get('/test-template/:template', (req, res, next) => {
  const { template } = req.params;
  const { data } = req.query;

  renderTemplate(template as any, {
    ...JSON.parse(Buffer.from(data as string, 'base64').toString()),
  })
    .then(html => {
      res.write(html);
      res.end();
    })
    .catch(e => next(e));
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
  next: NextFunction
) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json(res.locals);
});

app.listen(4500, () => {
  console.log('listening');
});
