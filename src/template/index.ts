import { promises } from 'fs';
import { join } from 'path';

import handlebar from 'handlebars';
import { PDFOptions } from 'puppeteer';
// register helpers
import './helpers';
import './partials';

type TemplateNames =
  | 'proposal-main.hbs'
  | 'questionary-step.hbs'
  | 'technical-review.hbs'
  | 'sample.hbs'
  | 'shipment-label.hbs';

const templatesFolder = join(__dirname, '..', '..', 'templates');

export async function render(
  pdfTemplate: string,
  payload: any
): Promise<string> {
  const template = handlebar.compile(pdfTemplate);

  return template(payload);
}

export async function renderTemplate(
  templateName: TemplateNames,
  payload: any
) {
  const htmlTemplate = await promises.readFile(
    join(templatesFolder, templateName),
    'utf-8'
  );

  // TODO: cache
  const template = handlebar.compile(htmlTemplate);

  return template(payload);
}

export async function renderHeaderFooter(proposalId?: string) {
  const htmlHeaderTemplate = await promises.readFile(
    join(templatesFolder, 'pdf', 'header.hbs'),
    'utf-8'
  );

  const htmlFooterTemplate = await promises.readFile(
    join(templatesFolder, 'pdf', 'footer.hbs'),
    'utf-8'
  );

  const settings: PDFOptions = JSON.parse(
    await promises.readFile(
      join(templatesFolder, 'pdf', 'settings.json'),
      'utf-8'
    )
  );

  const headerData = {
    logoPath: process.env.HEADER_LOGO_PATH
      ? process.env.HEADER_LOGO_PATH
      : join(process.cwd(), './templates/images/ESS.png'),
    proposalId,
  };

  return {
    ...settings,
    headerTemplate: handlebar.compile(htmlHeaderTemplate)(headerData),
    footerTemplate: handlebar.compile(htmlFooterTemplate)(null),
  };
}

export async function renderHeader(proposalId?: string) {
  const htmlHeaderTemplate = await promises.readFile(
    join(templatesFolder, 'pdf', 'header.hbs'),
    'utf-8'
  );

  const headerData = {
    logoPath: process.env.HEADER_LOGO_PATH
      ? process.env.HEADER_LOGO_PATH
      : join(process.cwd(), './templates/images/ESS.png'),
    proposalId,
  };

  return handlebar.compile(htmlHeaderTemplate)(headerData);
}

export async function renderFooter() {
  const htmlFooterTemplate = await promises.readFile(
    join(templatesFolder, 'pdf', 'footer.hbs'),
    'utf-8'
  );

  return handlebar.compile(htmlFooterTemplate)(null);
}
