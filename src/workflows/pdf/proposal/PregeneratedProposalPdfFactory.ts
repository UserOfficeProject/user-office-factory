import { logger } from '@user-office-software/duo-logger';

import PostgresFileDataSource from '../../../dataSources/postgres/FileDataSource';
import { PregeneratedProposalPDFData, Role } from '../../../types';
import PdfFactory, { PdfFactoryCountedPagesMeta } from '../PdfFactory';
import { PregeneratedProposalPDFMeta } from './ProposalPDFMeta';

export class PregeneratedPdfFactory extends PdfFactory<
  PregeneratedProposalPDFData,
  PregeneratedProposalPDFMeta
> {
  protected countedPagesMeta: PdfFactoryCountedPagesMeta<PregeneratedProposalPDFMeta>;
  static ENTITY_NAME = 'Proposal';
  protected meta: PregeneratedProposalPDFMeta = {
    files: {
      proposal: '',
    },
    type: 'pregenerated',
  };

  constructor(entityId: number, userRole: Role) {
    super(entityId, userRole);
  }

  init(data: PregeneratedProposalPDFData): void {
    this.countedPagesMeta = {
      proposal: { waitFor: 1, countedPagesPerPdf: {} },
    };

    const tasksNeeded = ['download:proposal', 'count-pages:proposal'];

    logger.logDebug(this.logPrefix + 'tasks needed to complete', {
      tasksNeeded,
    });

    /**
     * Listeners
     */
    this.once('download:proposal', this.downloadProposal);
    this.once('countPages', this.countPages);

    this.once('downloaded:proposal', (pdfPath) => {
      this.meta.files.proposal = pdfPath;
      this.emit('taskFinished', 'download:proposal');
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
    this.emit('download:proposal', data);
  }

  async downloadProposal(data: PregeneratedProposalPDFData): Promise<void> {
    const fileDataSource = new PostgresFileDataSource();

    const pdfPath = await fileDataSource.prepare(
      data.proposal.fileId,
      data.proposal.fileId
    );

    this.emit('downloaded:proposal', pdfPath);
    this.emit('countPages', pdfPath, 'proposal');
  }
}
