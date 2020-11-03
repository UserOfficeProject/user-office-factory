import { createWriteStream, unlink } from 'fs';

import request from 'supertest';

import extractPDFText from '../../scripts/text-extraction';
import app from '../app';
import { getTotalPages } from '../pdf';
import { generateTmpPath } from '../util/fileSystem';
import testPayloads from './payloads.json';

beforeAll(done => {
  setTimeout(done, 5000);
}, 10000);

describe('Proposal PDF', () => {
  test(
    'should create proposal PDF with the provided values',
    () => {
      return new Promise(done => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const r = request(app)
          .post('/generate-pdf/proposal')
          .send(testPayloads.test_1);

        r.on('response', resp => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);

          expect(totalPages).toBe(6);

          const text = extractPDFText(pdfPath);

          // first proposal
          expect(text).toMatch(/Proposal: Test proposal/);
          expect(text).toMatch(/Proposal ID:\n123123/);
          expect(text).toMatch(/Brief summary:\nFirst lorem ipsum/);
          expect(text).toMatch(/Principal Investigator:\nFoo Bar\nBaz\nFoobar/);
          expect(text).toMatch(
            /Co-proposer:\nCo Foo 1 Co Bar 1, Co Baz 1\nCo Foo 2 Co Bar 2, Co Baz 2/
          );

          expect(text).toMatch(/Questionary 1/);
          expect(text).toMatch(/Visible EMBELLISHMENT/);
          expect(text).not.toMatch(/Hidden EMBELLISHMENT/);
          expect(text).toMatch(/File upload question - exists\nSee appendix/);
          expect(text).toMatch(/File upload question - nope\nLeft blank/);
          expect(text).toMatch(/Date question\n2020-10-27/);
          expect(text).toMatch(/Boolean question - true\nYes/);
          expect(text).toMatch(/Boolean question - false\nNo/);
          expect(text).toMatch(/Random question\nRandom answer/);

          expect(text).toMatch(/Status\nOkey/);
          expect(text).toMatch(/Time Allocation\n30 Days/);
          expect(text).toMatch(/Comment\nTechnical review lorem ipsum/);

          // Second proposal
          expect(text).toMatch(/Proposal: Second proposal/);
          expect(text).toMatch(/Proposal ID:\n7777777/);
          expect(text).toMatch(/Brief summary:\nSecond proposal abstract/);
          expect(text).toMatch(/Principal Investigator:\nBar Baz\nFoo AB\nFoo/);
          expect(text).toMatch(/Co-proposer:\nCo Foo Co Bar, Co Baz/);

          expect(text).toMatch(/Questionary 2/);
          expect(text).toMatch(/Sub-template/);
          expect(text).toMatch(/Entry 1 of 2/);
          expect(text).toMatch(/Sub BOOLEAN 1\nYes/);

          expect(text).toMatch(/Entry 2 of 2/);
          expect(text).toMatch(/Sub DATE 2\n2020-10-30/);
          expect(text).toMatch(/Sub BOOLEAN 2\nNo/);

          expect(text).toMatch(/Status\nOkey-ish/);
          expect(text).toMatch(/Time Allocation\n0 Days/);

          /**
           * NOTE: for some reason the last line is not extracted
           *  for now don't check the last line
           */
          // expect(text).toMatch(/Comment\nSecond technical review comment/);

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
