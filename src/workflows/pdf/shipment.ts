import { logger } from '@user-office-software/duo-logger';

import { FileMetadata } from '../../models/File';
import { generatePdfFromHtml } from '../../pdf';
import { renderTemplate } from '../../template';
import { Attachment, Shipment, ShipmentPDFData } from '../../types';
import PdfFactory, { PdfFactoryCountedPagesMeta } from './PdfFactory';
import PdfWorkflowManager from './PdfWorkflowManager';

type ShipmentPDFMeta = {
  files: {
    shipment: string;
  };
  attachmentsFileMeta: FileMetadata[]; // TODO make attachmentsFileMeta in interface optional and delete this
  attachments: Attachment[]; // TODO make attachments in interface optional and delete this
};

type ShipmentPDFPagesMeta = PdfFactoryCountedPagesMeta<ShipmentPDFMeta>;

export class ShipmentPdfFactory extends PdfFactory<
  ShipmentPDFData,
  ShipmentPDFMeta
> {
  protected countedPagesMeta: ShipmentPDFPagesMeta;
  protected meta: ShipmentPDFMeta = {
    files: {
      shipment: '',
    },
    attachmentsFileMeta: [],
    attachments: [],
  };

  static ENTITY_NAME = 'Shipment';

  init(data: ShipmentPDFData) {
    const { shipment } = data;

    /**
     * Generate task list to track what needs to be done
     */

    const tasksNeeded = ['render:shipment'];

    logger.logDebug(this.logPrefix + 'tasks needed to complete', {
      tasksNeeded,
    });

    /**
     * Listeners
     */

    this.once('cleanup', this.cleanup);

    this.once('render:shipment', this.renderShipment);

    this.once('rendered:shipment', (pdfPath) => {
      this.meta.files.shipment = pdfPath;
      this.emit('taskFinished', 'render:shipment');
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

    this.emit('render:shipment', shipment);
  }

  private async renderShipment(shipment: Shipment) {
    if (this.stopped) {
      this.emit('aborted', 'renderShipment');

      return;
    }

    try {
      const renderedShipmentHtml = await renderTemplate('shipment-label.hbs', {
        shipment,
      });

      const pdfPath = await generatePdfFromHtml(renderedShipmentHtml);

      this.emit('rendered:shipment', pdfPath);
    } catch (e) {
      this.emit('error', e, 'renderShipment');
    }
  }
}

export default function newShipmentPdfWorkflowManager(data: ShipmentPDFData[]) {
  const manager = new PdfWorkflowManager<
    ShipmentPDFData,
    ShipmentPDFMeta,
    ShipmentPdfFactory
  >(ShipmentPdfFactory, data, (data) => data.shipment.id);

  manager.onFinalizePDF(({ meta, filePaths }) => {
    filePaths.push(meta.files.shipment);

    return 1;
  });

  manager.start();

  return manager;
}
