import { readFileSync } from 'fs';
import { extname } from 'path';

import handlebar from 'handlebars';

handlebar.registerHelper('$eq', function (a, b) {
  return a == b;
});

handlebar.registerHelper('$in', function <T>(...args: T[]) {
  args.pop(); // Remove the Handlebars options object
  const [a, ...b] = args;

  return b.includes(a);
});

handlebar.registerHelper('$notEq', function (a, b) {
  return a != b;
});

handlebar.registerHelper('$sum', function (...args) {
  args.pop();

  return args.reduce((sum, curr) => sum + curr, 0);
});

handlebar.registerHelper('$join', function (src, delimiter) {
  if (!Array.isArray(src)) {
    return src;
  }

  return src.join(delimiter);
});

handlebar.registerHelper('$or', function (...args) {
  args.pop();

  return args.some((value) => !!value);
});

handlebar.registerHelper('$readableDate', function (date) {
  if (date === undefined) {
    return '';
  }

  const dateObj = new Date(date);
  const options: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };

  return dateObj.toLocaleDateString('en-GB', options);
});

const extensionMimeTypeMp = new Map<string, string>([['.png', 'image/png']]);
const base64Cache = new Map<string, Buffer>();

handlebar.registerHelper('$readAsBase64', function (path: string) {
  let contentBuff = base64Cache.get(path);

  if (contentBuff === undefined) {
    contentBuff = readFileSync(path);
    base64Cache.set(path, contentBuff);
  }

  const mimeType = extensionMimeTypeMp.get(extname(path)) ?? 'unknown';

  return `data:${mimeType};base64,${contentBuff.toString('base64')}`;
});
