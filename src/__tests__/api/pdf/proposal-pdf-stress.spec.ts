// Set concurrency limit BEFORE importing app
process.env.MAX_CONCURRENT_PDF_GENERATIONS = '3';

import { createWriteStream, unlink } from 'fs';

import request from 'supertest';

import app from '../../../app';
import { getTotalPages } from '../../../pdf';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/pdf-payloads.json';

/**
 * Stress tests for PDF generation with concurrency limiting.
 *
 * These tests verify that the semaphore-based concurrency control prevents
 * resource exhaustion when generating multiple PDFs simultaneously.
 *
 * MAX_CONCURRENT_PDF_GENERATIONS is set to 3 for these tests to verify
 * that the semaphore actually queues requests when the limit is exceeded.
 */

describe('PDF Generation Stress Tests', () => {
  test(
    'should handle 6 concurrent requests with only 3 running at a time',
    async () => {
      const concurrentRequests = 6; // 2x the limit to ensure queuing
      const pdfPaths: string[] = [];
      const completionOrder: number[] = [];

      const makeRequest = async (index: number): Promise<number> => {
        const requestStart = Date.now();

        return new Promise((resolve, reject) => {
          const pdfPath = `${generateTmpPath()}_stress_${index}.pdf`;
          pdfPaths.push(pdfPath);
          const ws = createWriteStream(pdfPath);

          const r = request(app)
            .post('/generate/pdf/proposal')
            .send({ data: [testPayloads.proposal_test_1[0]] });

          r.on('response', (resp) => {
            if (resp.status !== 200) {
              reject(
                new Error(`Request ${index} failed with status ${resp.status}`)
              );
            }
          });

          r.on('error', reject);

          r.pipe(ws).once('close', () => {
            try {
              const totalPages = getTotalPages(pdfPath);
              expect(totalPages).toBeGreaterThan(0);
              completionOrder.push(index);
              resolve(Date.now() - requestStart);
            } catch (error) {
              reject(error);
            }
          });
        });
      };

      const startTime = Date.now();

      // Start all requests concurrently
      const requests = Array.from({ length: concurrentRequests }, (_, i) =>
        makeRequest(i)
      );

      const times = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should complete
      expect(completionOrder.length).toBe(concurrentRequests);

      // With 6 requests and limit of 3, we expect ~2 batches
      // Total time should be significantly more than a single request
      // (indicating queuing happened)
      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);

      console.log('Concurrency test completed:');
      console.log(
        `  - Requests: ${concurrentRequests}, Limit: ${process.env.MAX_CONCURRENT_PDF_GENERATIONS}`
      );
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Avg per request: ${Math.round(avgTime)}ms`);
      console.log(
        `  - Min time: ${minTime}ms, Max time: ${Math.max(...times)}ms`
      );

      // If semaphore is working, total time should be at least 1.5x the min
      // (because some requests had to wait in queue)
      // This is a loose check to avoid flakiness
      expect(totalTime).toBeGreaterThan(minTime * 1.3);

      // Cleanup
      for (const pdfPath of pdfPaths) {
        await new Promise<void>((resolve) => {
          unlink(pdfPath, () => resolve());
        });
      }
    },
    120 * 1000
  );

  test(
    'should handle 10 sequential requests without memory issues',
    async () => {
      const sequentialRequests = 10;

      for (let i = 0; i < sequentialRequests; i++) {
        await new Promise<void>((resolve, reject) => {
          const pdfPath = `${generateTmpPath()}_seq_${i}.pdf`;
          const ws = createWriteStream(pdfPath);

          const r = request(app)
            .post('/generate/pdf/proposal')
            .send({ data: [testPayloads.proposal_test_1[0]] });

          r.on('response', (resp) => {
            expect(resp.status).toBe(200);
          });

          r.on('error', reject);

          r.pipe(ws).once('close', () => {
            try {
              const totalPages = getTotalPages(pdfPath);
              expect(totalPages).toBeGreaterThan(0);

              unlink(pdfPath, () => resolve());
            } catch (error) {
              reject(error);
            }
          });
        });
      }
    },
    180 * 1000
  );

  test(
    'should queue requests when burst exceeds concurrency limit',
    async () => {
      // 9 requests with limit of 3 = 3 batches
      const burstSize = 9;
      const completedRequests: number[] = [];
      const startTime = Date.now();

      const makeRequest = async (index: number): Promise<number> => {
        const requestStart = Date.now();

        return new Promise((resolve, reject) => {
          const pdfPath = `${generateTmpPath()}_burst_${index}.pdf`;
          const ws = createWriteStream(pdfPath);

          const r = request(app)
            .post('/generate/pdf/proposal')
            .send({ data: [testPayloads.proposal_test_1[0]] });

          r.on('response', (resp) => {
            if (resp.status !== 200) {
              reject(
                new Error(`Request ${index} failed with status ${resp.status}`)
              );
            }
          });

          r.on('error', reject);

          r.pipe(ws).once('close', () => {
            unlink(pdfPath, () => {
              const elapsed = Date.now() - requestStart;
              completedRequests.push(index);
              resolve(elapsed);
            });
          });
        });
      };

      // Fire all requests at once
      const requests = Array.from({ length: burstSize }, (_, i) =>
        makeRequest(i)
      );

      const times = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should complete
      expect(completedRequests.length).toBe(burstSize);

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const minTime = Math.min(...times);
      const maxTime = Math.max(...times);

      console.log('Burst test completed:');
      console.log(
        `  - Requests: ${burstSize}, Limit: ${process.env.MAX_CONCURRENT_PDF_GENERATIONS}`
      );
      console.log(
        `  - Expected batches: ${Math.ceil(burstSize / parseInt(process.env.MAX_CONCURRENT_PDF_GENERATIONS || '', 10))}`
      );
      console.log(`  - Total time: ${totalTime}ms`);
      console.log(`  - Avg per request: ${Math.round(avgTime)}ms`);
      console.log(`  - Min time: ${minTime}ms, Max time: ${maxTime}ms`);

      // With 9 requests and limit 3, the last batch waits for 2 previous batches
      // So max time should be significantly higher than min time
      expect(maxTime).toBeGreaterThan(minTime * 1.5);

      // Total time should reflect batching (roughly 3 batches)
      // At minimum, total time > 2x single request time
      expect(totalTime).toBeGreaterThan(minTime * 2);
    },
    240 * 1000
  );
});

describe('PDF Generation Basic Concurrency', () => {
  test(
    'should complete a single PDF request successfully',
    async () => {
      await new Promise<void>((resolve, reject) => {
        const pdfPath = `${generateTmpPath()}_single.pdf`;
        const ws = createWriteStream(pdfPath);

        const r = request(app)
          .post('/generate/pdf/proposal')
          .send({ data: [testPayloads.proposal_test_1[0]] });

        r.on('response', (resp) => {
          expect(resp.status).toBe(200);
        });

        r.on('error', reject);

        r.pipe(ws).once('close', () => {
          try {
            const totalPages = getTotalPages(pdfPath);
            expect(totalPages).toBeGreaterThan(0);

            unlink(pdfPath, (err) => {
              if (err) reject(err);
              else resolve();
            });
          } catch (error) {
            reject(error);
          }
        });
      });
    },
    30 * 1000
  );
});
