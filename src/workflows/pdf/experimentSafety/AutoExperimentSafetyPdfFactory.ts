import { logger } from '@user-office-software/duo-logger';

import {
  ExperimentSafetyCountedPagesMeta,
  ExperimentSafetyPDFMeta,
} from './ExperimentSafetyPDFMeta';
import { generatePdfFromHtml } from '../../../pdf';
import { renderTemplate } from '../../../template';
import { ExperimentSafetyPDFData } from '../../../types';
import PdfFactory from '../PdfFactory';

export class AutoExperimentSafetyPdfFactory extends PdfFactory<
  ExperimentSafetyPDFData,
  ExperimentSafetyPDFMeta
> {
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
    isPregeneratedPdfMeta: false,
  };

  static ENTITY_NAME = 'ExperimentSafety';

  init(data: ExperimentSafetyPDFData) {
    const { experimentSafety } = data;

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

    try {
      const [renderedExperimentSafetyHtml] = await Promise.all([
        renderTemplate('experiment-safety-main.hbs', data),
      ]);

      const pdfOptions = {
        margin: {
          top: 40,
          left: 40,
          bottom: 40,
          right: 40,
        },
        displayHeaderFooter: false,
      };

      const pdf = await generatePdfFromHtml(renderedExperimentSafetyHtml, {
        pdfOptions,
      });
      if (pdf) {
        this.emit('countPages', pdf.pdfPath, 'experimentSafety');
        this.emit('rendered:experimentSafety', pdf);
      }
    } catch (e) {
      this.emit('error', e, 'renderExperimentSafety');
    }
  }
}
