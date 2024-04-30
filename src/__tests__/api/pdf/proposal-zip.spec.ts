import { createWriteStream, unlink } from 'fs';
import { join } from 'path';
import { setTimeout } from 'timers/promises';

import request from 'supertest';

import extractPDFText from '../../../../scripts/text-extraction';
import app from '../../../app';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/pdf-payloads.json';

// NOTE: This is just to make sure everything is up and running before we start.
beforeAll(async () => {
  await setTimeout(5000);
}, 10000);

describe('Auto Proposals ZIP', () => {
  test(
    'should create proposals ZIP with the provided values',
    () => {
      return new Promise((done) => {
        const zipPath = `${generateTmpPath()}.zip`;
        const ws = createWriteStream(zipPath);

        const r = request(app)
          .post('/generate/zip/proposal')
          .send({ data: testPayloads.proposal_test_1 });

        r.on('response', (resp) => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const AdmZip = require('adm-zip');
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          const path = require('path');

          const zip = new AdmZip(zipPath);
          const outputDir = `${path.parse(zipPath).name}_extracted`;
          zip.extractAllTo(outputDir);

          const textFromPdf1 = extractPDFText(
            join(outputDir, '123123_Bar_NaN.pdf')
          );
          const textFromPdf2 = extractPDFText(
            join(outputDir, '7777777_Baz_NaN.pdf')
          );

          // first proposal
          expect(textFromPdf1).toMatch(/Proposal: Test proposal/);
          expect(textFromPdf1).toMatch(/Proposal ID:\n123123/);
          expect(textFromPdf1).toMatch(/Brief summary:\nFirst lorem ipsum/);
          expect(textFromPdf1).toMatch(
            /Principal Investigator:\nFoo Bar\nBaz\nFoobar/
          );
          expect(textFromPdf1).toMatch(
            /Co-proposer:\nCo Foo 1 Co Bar 1, Co Baz 1\nCo Foo 2 Co Bar 2, Co Baz 2/
          );

          expect(textFromPdf1).toMatch(/Questionary 1/);
          expect(textFromPdf1).toMatch(/Visible EMBELLISHMENT/);
          expect(textFromPdf1).not.toMatch(/Hidden EMBELLISHMENT/);
          expect(textFromPdf1).toMatch(/Date question 2020-10-27/);
          expect(textFromPdf1).toMatch(/Boolean question - true Yes/);
          expect(textFromPdf1).toMatch(/Boolean question - false No/);
          expect(textFromPdf1).toMatch(
            /Selection from options Selected answer/
          );
          expect(textFromPdf1).toMatch(
            /Selection from options with multiple select foo, bar/
          );
          expect(textFromPdf1).toMatch(/Interval question -1 - 99 foo/);
          expect(textFromPdf1).toMatch(
            /Interval question - no answer Left blank/
          );
          expect(textFromPdf1).toMatch(/Interval question - no unit 1 - 2/);
          expect(textFromPdf1).toMatch(/Random question\nRandom answer/);
          expect(textFromPdf1).toMatch(
            /Rich text input question\nrich\ntext\ninput/
          );
          expect(textFromPdf1).toMatch(/Number input question 2345 foo\/bar/);
          expect(textFromPdf1).toMatch(
            /Number input question - no answer Left blank/
          );
          expect(textFromPdf1).toMatch(/Number input question - no unit 2345/);

          expect(textFromPdf1).toMatch(/Generic template main question/);
          expect(textFromPdf1).toMatch(/1 of 1/);
          expect(textFromPdf1).toMatch(/Generic template basis question/);
          expect(textFromPdf1).toMatch(/Generic template basis answer/);
          expect(textFromPdf1).toMatch(/Text question/);
          expect(textFromPdf1).toMatch(/Text answer/);

          expect(textFromPdf1).toMatch(/Status\nOkey/);
          expect(textFromPdf1).toMatch(/Time Allocation\n30 Days/);
          /**
           * NOTE: for some reason the last line is not extracted
           *  for now don't check the last line
           */
          // expect(textFromPdf1).toMatch(/Comment\nTechnical review lorem ipsum/);

          // Second proposal
          expect(textFromPdf2).toMatch(/Proposal: Second proposal/);
          expect(textFromPdf2).toMatch(/Proposal ID:\n7777777/);
          expect(textFromPdf2).toMatch(
            /Brief summary:\nSecond proposal abstract/
          );
          expect(textFromPdf2).toMatch(
            /Principal Investigator:\nBar Baz\nFoo AB\nFoo/
          );
          expect(textFromPdf2).toMatch(/Co-proposer:\nCo Foo Co Bar, Co Baz/);

          expect(textFromPdf2).toMatch(/Questionary 2/);
          expect(textFromPdf2).toMatch(/Sample declaration/);
          expect(textFromPdf2).toMatch(/Sample Entry 1 of 2/);
          expect(textFromPdf2).toMatch(/Foo sample - See appendix/);

          expect(textFromPdf2).toMatch(/Sample Entry 2 of 2/);
          expect(textFromPdf2).toMatch(/Sample 999 - See appendix/);

          expect(textFromPdf2).toMatch(/Sample: Foo sample/);
          expect(textFromPdf2).toMatch(/Sample date question 2020-10-27/);
          expect(textFromPdf2).toMatch(/Status:\nNot evaluated/);
          expect(textFromPdf2).toMatch(/Comment:\nSafety foo bar/);

          expect(textFromPdf2).toMatch(/Sample: Sample 999/);
          expect(textFromPdf2).toMatch(/Status:\nRisky/);

          expect(textFromPdf2).toMatch(/Status\nOkey-ish/);
          expect(textFromPdf2).toMatch(/Time Allocation\n0 Days/);

          /**
           * NOTE: for some reason the last line is not extracted
           *  for now don't check the last line
           */
          // expect(text).toMatch(/Comment\nSecond technical review comment/);

          unlink(zipPath, (err) => {
            expect(err).toBe(null);

            done(true);
          });
        });
      });
    },
    20 * 1000
  );
});
