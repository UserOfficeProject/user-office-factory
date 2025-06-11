import { join } from 'path';

import handlebar from 'handlebars';
import { PDFOptions } from 'puppeteer';

// register helpers
import './helpers';
import './partials';
import { getTemplateFile } from './getTemplateFile';

type TemplateNames =
  | 'proposal-main.hbs'
  | 'questionary-step.hbs'
  | 'technical-review.hbs'
  | 'sample.hbs'
  | 'shipment-label.hbs'
  | 'experiment-safety-main.hbs';

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
  const htmlTemplate = await getTemplateFile(templateName);

  const template = handlebar.compile(htmlTemplate);

  return template(payload);
}

export async function renderHeaderFooter(proposalId?: string) {
  const [htmlHeaderTemplate, htmlFooterTemplate, settingsContent] =
    await Promise.all([
      getTemplateFile('pdf/header.hbs'),
      getTemplateFile('pdf/footer.hbs'),
      getTemplateFile('pdf/settings.json'),
    ]);

  const settings: PDFOptions = JSON.parse(settingsContent);

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
  const htmlHeaderTemplate = await getTemplateFile('pdf/header.hbs');

  const headerData = {
    logoPath: process.env.HEADER_LOGO_PATH
      ? process.env.HEADER_LOGO_PATH
      : join(process.cwd(), './templates/images/ESS.png'),
    proposalId,
  };

  return handlebar.compile(htmlHeaderTemplate)(headerData);
}

export async function renderFooter() {
  const htmlFooterTemplate = await getTemplateFile('pdf/footer.hbs');

  return handlebar.compile(htmlFooterTemplate)(null);
}
