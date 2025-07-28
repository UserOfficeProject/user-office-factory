import { join } from 'path';

import { logger } from '@user-office-software/duo-logger';

import {
  ExperimentSafetyCountedPagesMeta,
  ExperimentSafetyPDFMeta,
} from './ExperimentSafetyPDFMeta';
import { generatePdfFromHtml } from '../../../pdf';
import { render } from '../../../template';
import { ExperimentSafetyPDFData, Role } from '../../../types';
import PdfFactory from '../PdfFactory';

/**
 * Generates PDFs based on a user officer defined template.
 */
export class CustomExperimentSafetyPdfFactory extends PdfFactory<
  ExperimentSafetyPDFData,
  ExperimentSafetyPDFMeta
> {
  protected templateBody: string;
  protected templateHeader?: string;
  protected templateFooter?: string;
  protected sampleDeclaration?: string;

  protected countedPagesMeta: ExperimentSafetyCountedPagesMeta;
  protected meta: ExperimentSafetyPDFMeta = {
    files: {
      experimentSafety: '',
    },
    toc: {
      experimentSafety: [],
    },
    attachmentsFileMeta: [],
    attachments: [],
    type: 'experimentSafety',
  };

  static ENTITY_NAME = 'ExperimentSafety';

  constructor(
    entityId: number,
    userRole: Role,
    templateBody: string,
    templateHeader?: string,
    templateFooter?: string,
    sampleDeclaration?: string
  ) {
    super(entityId, userRole);
    this.templateBody = templateBody;
    this.templateHeader = templateHeader;
    this.templateFooter = templateFooter;
    this.sampleDeclaration = sampleDeclaration;
  }

  init(data: ExperimentSafetyPDFData) {
    logger.logDebug(this.logPrefix + 'init', { data });
    this.countedPagesMeta = {
      experimentSafety: { waitFor: 1, countedPagesPerPdf: {} },
    };
    /**
     * Generate task list to track what needs to be done
     */
    const tasksNeeded = [
      'render:experimentSafety',
      'count-pages:experimentSafety',
    ];

    logger.logDebug(this.logPrefix + 'tasks needed to complete', {
      tasksNeeded,
    });

    /**
     * Listeners
     */
    this.on('countPages', this.countPages);

    this.once('render:experimentSafety', this.renderExperimentSafety);
    this.once('rendered:experimentSafety', (pdf) => {
      this.meta.files.experimentSafety = pdf.pdfPath;
      this.meta.toc.experimentSafety = pdf.toc;
      this.emit('taskFinished', 'render:experimentSafety');
    });

    this.on('taskFinished', (task) => {
      logger.logDebug(this.logPrefix + 'task finished', { task });
      tasksNeeded.splice(tasksNeeded.indexOf(task), 1);

      if (tasksNeeded.length === 0 && !this.stopped) {
        logger.logDebug(this.logPrefix + 'every task finished', { task });
        this.emit('done', this.meta, this.countedPagesMeta);
      }
    });

    /**
     * Emitters
     */
    this.emit('render:experimentSafety', data);
  }

  private async renderExperimentSafety(data: ExperimentSafetyPDFData) {
    if (this.stopped) {
      this.emit('aborted', 'renderExperimentSafety');

      return;
    }

    let headerTemplate;
    let footerTemplate;
    try {
      const renderedExperimentSafetyHtml = await render(
        this.templateBody,
        data
      );

      if (this.templateHeader) {
        headerTemplate = await render(this.templateHeader, {
          ...data,
          logoPath: process.env.HEADER_LOGO_PATH
            ? process.env.HEADER_LOGO_PATH
            : join(process.cwd(), './templates/images/ESS.png'),
        });
      }

      if (this.templateFooter) {
        footerTemplate = await render(this.templateFooter, data);
      }
      const pdfOptions = {
        margin: {
          top: 40,
          left: 40,
          bottom: 40,
          right: 40,
        },
        displayHeaderFooter: !!headerTemplate || !!footerTemplate,
        headerTemplate: headerTemplate ?? '<></>',
        footerTemplate: footerTemplate ?? '<></>',
      };

      const pdf = await generatePdfFromHtml(renderedExperimentSafetyHtml, {
        pdfOptions: pdfOptions,
      });
      this.emit('countPages', pdf.pdfPath, 'experimentSafety');
      this.emit('rendered:experimentSafety', pdf);
    } catch (e) {
      this.emit('error', e, 'renderExperimentSafety');
    }
  }
}
