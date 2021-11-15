import { readFileSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';

import handlebar from 'handlebars';

function registerPartials() {
  const partialsDir = join(__dirname, '..', '..', 'templates', 'partials');

  readdirSync(partialsDir).forEach((file) => {
    if (extname(file) !== '.hbs') {
      return;
    }

    const content = readFileSync(join(partialsDir, file), 'utf-8');

    handlebar.registerPartial(basename(file, '.hbs'), content);
  });
}

registerPartials();
