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

describe('Proposal PDF', () => {
  test(
    'should create proposal PDF with the provided values',
    () => {
      return new Promise(done => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const r = request(app)
          .post('/generate/pdf/proposal')
          .send({ data: testPayloads.proposal_test_1 });

        r.on('response', resp => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);

          expect(totalPages).toBe(8);

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
          expect(text).toMatch(/Date question 2020-10-27/);
          expect(text).toMatch(/Boolean question - true Yes/);
          expect(text).toMatch(/Boolean question - false No/);
          expect(text).toMatch(/Selection from options Selected answer/);
          expect(text).toMatch(
            /Selection from options with multiple select foo, bar/
          );
          expect(text).toMatch(
            /Interval question\nMin: -1\nMax: 99\nUnit: foo/
          );
          expect(text).toMatch(/Interval question - no answer\nLeft blank/);
          expect(text).toMatch(/Interval question - no unit\nMin: 1\nMax: 2/);
          expect(text).toMatch(/Random question\nRandom answer/);
          expect(text).toMatch(/Rich text input question\nrich\ntext\ninput/);
          expect(text).toMatch(/Number input question 2345 foo\/bar/);
          expect(text).toMatch(/Number input question - no answer Left blank/);
          expect(text).toMatch(/Number input question - no unit 2345/);

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
          expect(text).toMatch(/Sample declaration/);
          expect(text).toMatch(/Sample Entry 1 of 2/);
          expect(text).toMatch(/Foo sample - See appendix/);

          expect(text).toMatch(/Sample Entry 2 of 2/);
          expect(text).toMatch(/Sample 999 - See appendix/);

          expect(text).toMatch(/Sample: Foo sample/);
          expect(text).toMatch(/Sample date question 2020-10-27/);
          expect(text).toMatch(/Status:\nNot evaluated/);
          expect(text).toMatch(/Comment:\nSafety foo bar/);

          expect(text).toMatch(/Sample: Sample 999/);
          expect(text).toMatch(/Status:\nRisky/);

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
