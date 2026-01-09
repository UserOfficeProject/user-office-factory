import { createWriteStream, unlink } from 'fs';
import { setTimeout } from 'timers/promises';

import request from 'supertest';

import extractPDFText from '../../../../scripts/text-extraction';
import app from '../../../app';
import { getTotalPages } from '../../../pdf';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/pdf-payloads.json';

// NOTE: This is just to make sure everything is up and running before we start.
beforeAll(async () => {
  await setTimeout(5000);
}, 10000);

describe('Auto Experiment Safety PDF', () => {
  test(
    'should create Experiment Safety PDF with the provided values',
    () => {
      return new Promise((done) => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const r = request(app)
          .post('/generate/pdf/experiment-safety')
          .send({ data: testPayloads.experiment_safety_test_1 });

        r.on('response', (resp) => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);
          console.log('Total pages:', totalPages);

          expect(totalPages).toBe(1);

          const text = extractPDFText(pdfPath);

          // Header and general info
          expect(text).toMatch(/Experiment Risk Assessment/);
          expect(text).toMatch(/ID: TEST-123-1/);
          expect(text).toMatch(/Experiment Number: TEST-123-1/);
          expect(text).toMatch(/Approved/);

          // Experimenter and Principal Investigator info
          expect(text).toMatch(/Principal Investigator\nJohn Smith/);

          // Safety review information
          expect(text).toMatch(/Information by Safety Review Team/);
          expect(text).toMatch(/Hot/);
          expect(text).toMatch(/Activity of nuclides \(Bq\): 1/);
          expect(text).toMatch(/Dose rate \(uSv\/Hr\):: 1/);
          expect(text).toMatch(/Containment: Cold Box/);
          expect(text).toMatch(/Facility Internal Code: BIO-FAC-12A/);
          expect(text).toMatch(/Hazard Category: HIGH/);
          expect(text).toMatch(/Hazard Type: Radioactive/);

          // Information about disposal and transport
          expect(text).toMatch(
            /How is the Displosal being handled\?: Disposal is managed in accordance with safety and environmental/
          );

          // Experimenter submitted info
          expect(text).toMatch(
            /Experiment Safety Input Submitted by the Experimenter/
          );
          expect(text).toMatch(
            /Is there any other hazards that could be expected at the experiment site\?:\s+Yes,\s+potential\s+hazards\s+include\s+electrical,\s+chemical,\s+and\s+radiation\s+risks\.\s+Safety\s+measures\s+required\./
          );

          // Sample information
          expect(text).toMatch(/Samples Submitted by the Experimenter/);
          expect(text).toMatch(/Sample: Test Sample/);
          expect(text).toMatch(
            /Are there any Radioactive hazards associated with your sample\?: Yes/
          );
          expect(text).toMatch(/10 Tesla Magnet: Yes/);
          expect(text).toMatch(/Yes\/No: Yes/);
          expect(text).toMatch(
            /Please give more details \(max 100 characters\): Test sample details for experiment/
          );
          expect(text).toMatch(/Total number of the same sample: 23/);
          expect(text).toMatch(/Please give details: Test sample material/);
          expect(text).toMatch(
            /Is your sample sensitive to water vapour\?: Yes/
          );
          expect(text).toMatch(/Water Bath: No/);

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
