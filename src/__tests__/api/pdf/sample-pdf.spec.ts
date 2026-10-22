import { createWriteStream, unlink } from 'fs';

import request from 'supertest';

import app from '../../../app';
import { getTotalPages } from '../../../pdf';
import extractPDFText from '../../../scripts/text-extraction';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/pdf-payloads.json';

describe('Sample PDF', () => {
  const originalPdfGenerationEngine = process.env.PDF_GENERATION_ENGINE;

  afterEach(() => {
    if (originalPdfGenerationEngine === undefined) {
      delete process.env.PDF_GENERATION_ENGINE;
    } else {
      process.env.PDF_GENERATION_ENGINE = originalPdfGenerationEngine;
    }
  });

  test.each(['puppeteer', 'pdfmake'] as const)(
    'should create sample PDF with the provided values using %s',
    (engine) => {
      process.env.PDF_GENERATION_ENGINE = engine;

      return new Promise((done) => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const r = request(app)
          .post('/generate/pdf/sample')
          .send({ data: testPayloads.sample_test_1 });

        r.on('response', (resp) => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);

          expect(totalPages).toBe(1);

          const text = extractPDFText(pdfPath).replace(/\0/g, '');

          expect(text).toMatch(/Sample: Foo sample/);
          expect(text).toMatch(/Sample basis question\s+Foo sample/);
          expect(text).toMatch(/Date question 2020-10-27/);

          expect(text).toMatch(/Status:\s+Not evaluated/);
          expect(text).toMatch(/Comment:/);

          expect(text).toMatch(/Safety foo bar/);

          unlink(pdfPath, (err) => {
            expect(err).toBe(null);

            done(true);
          });
        });
      });
    },
    20 * 1000
  );
});
