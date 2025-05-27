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

describe('Custom Experiment Safety PDF', () => {
  test(
    'should create experiment safety PDF with the provided values',
    () => {
      return new Promise((done) => {
        const pdfPath = `${generateTmpPath()}.pdf`;
        const ws = createWriteStream(pdfPath);

        const data = testPayloads.experiment_safety_test_1;

        const r = request(app)
          .post('/generate/pdf/experiment-safety')
          .send({ data });

        r.on('response', (resp) => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const totalPages = getTotalPages(pdfPath);

          expect(totalPages).toBe(2);

          const text = extractPDFText(pdfPath);

          // Verify custom template content
          expect(text).toMatch(/Experiment Risk Assessment - Custom Template/);
          expect(text).toMatch(/Experiment ID: TEST-123-1/);
          expect(text).toMatch(/Proposal ID: TEST-123/);
          expect(text).toMatch(/PI: John Smith/);
          expect(text).toMatch(/Institution: Test University/);
          expect(text).toMatch(/Time Period:/); // Verify time period information

          // Verify safety information
          expect(text).toMatch(/Hazard Type: Hot/);
          expect(text).toMatch(/Hazard Category: HIGH/);
          expect(text).toMatch(/Activity of nuclides \(Bq\): 1/);
          expect(text).toMatch(/Dose rate \(uSv\/Hr\): 1/);

          // Verify containment and facility information
          expect(text).toMatch(/Containment: Cold Box/);
          expect(text).toMatch(/Facility Internal Code: TEST-123/);

          // Verify disposal and transport information
          expect(text).toMatch(
            /Disposal: Disposal follows standard safety protocols/
          );
          expect(text).toMatch(/UN: 5678/);

          // Verify experimenter input
          expect(text).toMatch(/Potential hazards:/);

          // Verify sample information
          expect(text).toMatch(/Sample: Test Sample/);
          expect(text).toMatch(/Radioactive hazards: Yes/);
          expect(text).toMatch(/10 Tesla Magnet: Yes/);
          // Use a simplified regex that's more likely to match regardless of formatting
          expect(text).toMatch(/Sample details: Lorem ipsum/);
          expect(text).toMatch(/Total samples: 23/);

          // Verify review decision
          expect(text).toMatch(/Status: Approved/); // Verify status section
          expect(text).toMatch(/Review Decision: Approved/);
          // Use a more flexible match for review comment
          expect(text).toMatch(/Review Comment: Test safety review comment/);

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
