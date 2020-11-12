import { promises } from 'fs';
import { join } from 'path';

import handlebar from 'handlebars';

// register helpers
import './helpers';

import './partials';

type TemplateNames =
  | 'proposal-main.hbs'
  | 'questionary-step.hbs'
  | 'technical-review.hbs'
  | 'sample.hbs';

export async function renderTemplate(
  templateName: TemplateNames,
  payload: any
) {
  const htmlTemplate = await promises.readFile(
    join(__dirname, '..', '..', 'templates', templateName),
    'utf-8'
  );

  // TODO: cache
  const template = handlebar.compile(htmlTemplate);

  return template(payload);
}
