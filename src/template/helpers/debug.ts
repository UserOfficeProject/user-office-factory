import { EOL } from 'os';

import handlebar from 'handlebars';

const regex = new RegExp(EOL, 'g');

handlebar.registerHelper(
  '$debug',
  /**
   * Takes the value and outputs it as JSON with HTML line breaks to make
   * debugging templates easier for template designers.
   *
   * Used as follows:
   *
   * {{$debug <value>}}
   */
  function (value: unknown) {
    return new handlebar.SafeString(
      JSON.stringify(value, null, 2).replace(regex, '<br>')
    );
  }
);
