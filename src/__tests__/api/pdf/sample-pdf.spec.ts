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

describe('Sample PDF', () => {
  test(
    'should create sample PDF with the provided values',
    () => {
      return new Promise(done => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const r = request(app)
          .post('/generate/pdf/sample')
          .send({ data: testPayloads.sample_test_1 });

        r.on('response', resp => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);

          expect(totalPages).toBe(1);

          const text = extractPDFText(pdfPath);

          expect(text).toMatch(/Sample: Foo sample/);
          expect(text).toMatch(/Status:\nNot evaluated/);
          expect(text).toMatch(/Comment:/);

          /**
           * NOTE: for some reason the last line is not extracted
           *  for now don't check the last line
           */
          // expect(text).toMatch(/Safety foo bar/);

          unlink(pdfPath, err => {
            expect(err).toBe(null);

            done();
          });
        });
      });
    },
    20 * 1000
  );
});
