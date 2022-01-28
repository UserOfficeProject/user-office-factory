import { createWriteStream, unlink } from 'fs';

import request from 'supertest';
import XLSX from 'xlsx';

import app from '../../../app';
import { generateTmpPath } from '../../../util/fileSystem';
import testPayloads from '../../fixtures/xlsx-payloads.json';

// NOTE: This is just to make sure everything is up and running before we start.
beforeAll(() => {
  //
}, 15000);

describe('SEP XLSX', () => {
  test(
    'should create SEP XLSX with the provided values',
    () => {
      return new Promise((done) => {
        const xlsxPath = `${generateTmpPath()}.xlsx`;
        const ws = createWriteStream(xlsxPath);

        const r = request(app)
          .post('/generate/xlsx/sep')
          .send(testPayloads.sep_test_1);

        r.on('response', (resp) => {
          expect(resp.status).toBe(200);
        });

        r.pipe(ws).once('close', () => {
          const wb = XLSX.readFile(xlsxPath);

          expect(wb.SheetNames).toEqual(['Instrument 1', 'Instrument 2']);

          wb.SheetNames.forEach((sheetName, sheetIndx) => {
            const [header, ...rows] = XLSX.utils.sheet_to_json(
              wb.Sheets[sheetName],
              {
                header: 1,
              }
            );

            expect(header).toEqual(testPayloads.sep_test_1.meta.columns);

            const data = testPayloads.sep_test_1.data[sheetIndx];
            data.rows.forEach((dataRow, indx) =>
              expect(rows[indx]).toEqual(dataRow)
            );
          });

          unlink(xlsxPath, (err) => {
            expect(err).toBe(null);

            done(true);
          });
        });
      });
    },
    30 * 1000
  );
});
