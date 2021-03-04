import { createWriteStream, unlink } from 'fs';

import request from 'supertest';

import extractPDFText from '../../../../scripts/text-extraction';
import app from '../../../app';
import { getTotalPages } from '../../../pdf';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/pdf-payloads.json';

beforeAll(done => {
  setTimeout(done, 5000);
}, 10000);

describe('Shipment label PDF', () => {
  test(
    'should create shipment label PDF with the provided values',
    () => {
      return new Promise(done => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const r = request(app)
          .post('/generate/pdf/shipment-label')
          .send({ data: testPayloads.shipment_label_test_1 });

        r.on('response', resp => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);

          expect(totalPages).toBe(1);

          const text = extractPDFText(pdfPath);

          expect(text).toMatch(/PROPOSAL\n22222/);

          unlink(pdfPath, err => {
            expect(err).toBe(null);

            done(true);
          });
        });
      });
    },
    20 * 1000
  );
});
