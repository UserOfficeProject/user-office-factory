import { EOL } from 'os';

import handlebar from 'handlebars';

const regex = new RegExp(EOL, 'g');

handlebar.registerHelper('$debug', function (value: unknown) {
  return new handlebar.SafeString(
    JSON.stringify(value, null, 2).replace(regex, '<br>')
  );
});
