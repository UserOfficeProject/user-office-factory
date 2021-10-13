import { createWriteStream, unlink } from 'fs';

import request from 'supertest';
import XLSX from 'xlsx';

import app from '../../../app';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/xlsx-payloads.json';

beforeAll(done => {
  setTimeout(done, 5000);
}, 10000);

describe('Proposal XLSX', () => {
  test(
    'should create Proposal XLSX with the provided values',
    () => {
      return new Promise(done => {
        const xlsxPath = `${generateTmpPath()}.xlsx`;
        const ws = createWriteStream(xlsxPath);

        const r = request(app)
          .post('/generate/xlsx/proposal')
          .send(testPayloads.proposal_test_1);

        r.on('response', resp => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const wb = XLSX.readFile(xlsxPath);

          expect(wb.SheetNames.length).toBe(1);

          wb.SheetNames.forEach(sheetName => {
            const [header, ...rows] = XLSX.utils.sheet_to_json(
              wb.Sheets[sheetName],
              {
                header: 1,
              }
            );

            expect(header).toEqual(testPayloads.proposal_test_1.meta.columns);

            const data = testPayloads.proposal_test_1.data;
            data.forEach((dataRow, indx) =>
              expect(rows[indx]).toEqual(dataRow)
            );
          });

          unlink(xlsxPath, err => {
            expect(err).toBe(null);

            done();
          });
        });
      });
    },
    20 * 1000
  );
});
