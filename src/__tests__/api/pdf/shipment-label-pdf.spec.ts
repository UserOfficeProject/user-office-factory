import { once } from 'events';
import { unlink, writeFile } from 'fs/promises';
import { createServer } from 'http';
import { AddressInfo } from 'net';

import request from 'supertest';

import app from '../../../app';
import { getTotalPages } from '../../../pdf';
import extractPDFText from '../../../scripts/text-extraction';
import { renderShipmentLabel } from '../../../template/shipmentLabel';
import { ShipmentPDFData } from '../../../types';
import { generateTmpPath } from '../../../util/fileSystem';

const shipment = {
  id: 11111,
  proposalId: '22222',
  externalRef: '33333',
  callShortCode: 'TEST-CALL',
  instrumentShortCodes: 'TEST-INSTRUMENT',
  localContact: 'Test Contact',
  weight: 12,
  width: 3,
  height: 4,
  length: 5,
};

async function getLabelText(data: ShipmentPDFData) {
  const response = await request(app)
    .post('/generate/pdf/shipment-label')
    .send({ data: [data] })
    .buffer(true)
    .expect(200)
    .expect('Content-Type', /application\/pdf/);
  const pdfPath = `${generateTmpPath()}.pdf`;
  await writeFile(pdfPath, response.body);
  try {
    expect(getTotalPages(pdfPath)).toBe(1);

    return extractPDFText(pdfPath);
  } finally {
    await unlink(pdfPath);
  }
}

describe('Shipment label PDF', () => {
  test('uses the legacy label fields when answers is missing', async () => {
    const text = await getLabelText({ shipment });

    expect(text).toMatch(/CONTAINER ID\s*33333/);
    expect(text).toMatch(/Weight:\s*12/);
    expect(text).toMatch(/Size:\s*3\s*x\s*4\s*x\s*5/);
  }, 30_000);

  test('prints routing metadata but not private answers on the default label', async () => {
    const text = await getLabelText({
      shipment,
      answers: { 'Sender phone': '123-555-0100' },
      pdfTemplate: null,
    });

    expect(text).toMatch(/CONTAINER ID\s*33333/);
    expect(text).toMatch(/Local contact:\s*Test Contact/);
    expect(text).toMatch(/Proposal ID:\s*22222/);
    expect(text).toContain('TEST-CALL');
    expect(text).toMatch(/TEST-\s*INSTRUMENT/);
    expect(text).not.toContain('Sender phone');
    expect(text).not.toContain('123-555-0100');
    expect(text).not.toContain('Weight:');
    expect(text).not.toContain('Size:');
  }, 30_000);

  test('renders custom HTML and inline styles without scripts or network requests', async () => {
    const handleRequest = jest.fn();
    const server = createServer((req, res) => {
      handleRequest(req.url);
      res.end();
    }).listen(0, '127.0.0.1');

    try {
      await once(server, 'listening');
      const { port } = server.address() as AddressInfo;
      const text = await getLabelText({
        shipment,
        answers: { 'Delivery instructions': 'Keep upright' },
        pdfTemplate: `<!doctype html>
          <style>.hidden { display: none; }</style>
          <h1>Custom label {{shipment.externalRef}}</h1>
          <p>{{#each answers}}{{@key}}: {{this}}{{/each}}</p>
          <p class="hidden">HIDDEN BY STYLE</p>
          <script>document.body.append('SCRIPT RAN')</script>
          <img src="http://127.0.0.1:${port}/image.png">
          {{shipmentBarcode}}{{shipmentQrCode}}`,
      });

      expect(text).toMatch(/Custom label\s*33333/);
      expect(text).toMatch(/Delivery instructions:\s*Keep upright/);
      expect(text).not.toContain('HIDDEN BY STYLE');
      expect(text).not.toContain('SCRIPT RAN');
      expect(handleRequest).not.toHaveBeenCalled();
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  }, 30_000);

  test('generates both custom graphics from the shipment external reference', async () => {
    const pdfTemplate = '{{shipmentBarcode}}{{shipmentQrCode}}';
    const first = await renderShipmentLabel({ shipment, pdfTemplate });
    const second = await renderShipmentLabel({
      shipment: { ...shipment, externalRef: '44444' },
      pdfTemplate,
    });
    const images = (html: string) =>
      html.match(/data:image\/png;base64,[\w+/=]+/g) ?? [];
    const [barcode, qrCode] = images(first.html);

    expect(images(first.html)).toHaveLength(2);
    expect(images(second.html)).toHaveLength(2);
    expect(images(second.html)[0]).not.toBe(barcode);
    expect(images(second.html)[1]).not.toBe(qrCode);
  });

  test.each([
    ['{{shipmentBarcode shipment.externalRef}}', 'does not accept arguments'],
    ['{{shipmentQrCode value="other"}}', 'does not accept arguments'],
    ['{{ $readAsBase64 "image.png" }}', 'unknown helper'],
  ])(
    'rejects unsupported custom template expression %s',
    async (pdfTemplate, message) => {
      await expect(
        renderShipmentLabel({ shipment, pdfTemplate })
      ).rejects.toThrow(message);
    }
  );
});
