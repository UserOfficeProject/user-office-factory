import { Canvas } from 'canvas';
import handlebars, { HelperOptions } from 'handlebars';
import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

import { ShipmentPDFData } from '../types';

import { renderTemplate } from './index';

const labelHeight = 130;

function createBarcode(externalRef: string) {
  const canvas = new Canvas(200, labelHeight);
  JsBarcode(canvas, externalRef, {
    displayValue: false,
    width: 3,
    height: labelHeight,
    margin: 0,
  });

  return canvas.toDataURL();
}

function renderCustomLabel(
  pdfTemplate: string,
  data: Pick<ShipmentPDFData, 'shipment' | 'answers'>,
  barcode: string,
  qrCode: string
) {
  const environment = handlebars.create();
  environment.unregisterHelper('log');

  function registerGraphic(name: string, src: string, alt: string) {
    environment.registerHelper(name, (...args: unknown[]) => {
      const options = args[args.length - 1] as HelperOptions;
      if (args.length !== 1 || Object.keys(options.hash).length !== 0) {
        throw new Error(`${name} does not accept arguments`);
      }

      return new environment.SafeString(`<img src="${src}" alt="${alt}">`);
    });
  }

  registerGraphic('shipmentBarcode', barcode, 'Shipment barcode');
  registerGraphic('shipmentQrCode', qrCode, 'Shipment QR code');

  return environment.compile(pdfTemplate, {
    knownHelpersOnly: true,
    knownHelpers: { shipmentBarcode: true, shipmentQrCode: true, log: false },
  })(data);
}

export async function renderShipmentLabel({
  shipment,
  answers,
  pdfTemplate,
}: ShipmentPDFData): Promise<{ html: string; custom: boolean }> {
  const containerIdBarcode = createBarcode(shipment.externalRef);
  const containerIdQRCode = await QRCode.toDataURL(shipment.externalRef, {
    width: labelHeight,
    margin: 0,
  });

  if (pdfTemplate != null) {
    return {
      html: renderCustomLabel(
        pdfTemplate,
        { shipment, answers },
        containerIdBarcode,
        containerIdQRCode
      ),
      custom: true,
    };
  }

  return {
    html: await renderTemplate('shipment-label.hbs', {
      shipment,
      useModernLayout: answers !== undefined,
      containerIdBarcode,
      containerIdQRCode,
    }),
    custom: false,
  };
}
