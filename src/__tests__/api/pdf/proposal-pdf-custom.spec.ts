import { createWriteStream, unlink } from 'fs';
import { setTimeout } from 'timers/promises';

import request from 'supertest';

import extractPDFText from '../../../../scripts/text-extraction';
import app from '../../../app';
import { getTotalPages } from '../../../pdf';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/pdf-payloads-custom';

// NOTE: This is just to make sure everything is up and running before we start.
beforeAll(async () => {
  await setTimeout(5000);
}, 10000);

describe('Custom Proposal PDF', () => {
  test(
    'should create proposal PDF with the provided values',
    () => {
      return new Promise((done) => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const data = testPayloads.proposal_test_1;

        const r = request(app).post('/generate/pdf/proposal').send({ data });

        r.on('response', (resp) => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);

          expect(totalPages).toBe(1);

          const text = extractPDFText(pdfPath);

          // first proposal
          expect(text).toMatch(/Custom template/);
          expect(text).toMatch(/Proposal title: Test proposal/);
          expect(text).toMatch(/Proposal ID: 123123/);
          expect(text).toMatch(/PI: Foo Bar Baz Foobar/);
          expect(text).toMatch(
            /CoIs: Co Foo 1 Co Bar 1 \(Co Baz 1\), Co Foo 2 Co Bar 2 \(Co Baz 2\)/
          );

          expect(text).toMatch(/Boolean question 1: true/);
          expect(text).toMatch(/Boolean question 2: false/);

          expect(text).toMatch(/Selection from options: Selected answer/);
          expect(text).toMatch(
            /Selection from options with multiple select: foo, bar/
          );

          expect(text).toMatch(/Interval question 1: -1 to 99 foo/);
          expect(text).toMatch(/Interval question 2: to/);
          expect(text).toMatch(/Interval question 3: 1 to 2/);

          expect(text).toMatch(/Random question: Random answer/);

          expect(text).toMatch(/Rich text:\nrich\ntext\ninput/);

          expect(text).toMatch(/Number input 1: 2345 foo\/bar/);
          expect(text).toMatch(/Number input 2: foo\/bar/);
          expect(text).toMatch(/Number input 3: 2345/);

          expect(text).toMatch(
            /Generic template:\nGeneric template basis answer Text answer 2\nGeneric template basis answer Text answer 3/
          );

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
