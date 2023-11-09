import { Readable } from 'stream';

import XLSXWorkflowManager from './XLSXWorkflowManager';
import { SEPXLSXData, XLSXMetaBase } from '../../types';
import { newWorkBook, appendSheet, finalizeAndCreate } from '../../xlsx';

const generateSEPXLSX =
  ({ data, meta }: { data: SEPXLSXData; meta: XLSXMetaBase }) =>
  async () => {
    const wb = newWorkBook();

    // handle edge case (no data)
    if (data.length === 0) {
      appendSheet(wb, 'Sheet 1', [], []);
    }

    for (const { sheetName, rows } of data) {
      appendSheet(wb, sheetName, meta.columns, rows);
    }

    const sheetBuffer = finalizeAndCreate(wb);
    const rs = Readable.from(sheetBuffer);

    return rs;
  };

export default function newSEPXLSXWorkflowManager(properties: {
  data: SEPXLSXData;
  meta: XLSXMetaBase;
}) {
  return new XLSXWorkflowManager(generateSEPXLSX(properties));
}
