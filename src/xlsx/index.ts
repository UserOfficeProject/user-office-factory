import XLSX, { WritingOptions } from 'xlsx';

export function create(
  dataColumns: string[],
  data: any[],
  options?: {
    sheetName?: string;
    writingOptions?: WritingOptions;
  }
): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([dataColumns, ...data]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, options?.sheetName || 'Sheet 1');

  return XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    ...options?.writingOptions,
  });
}

export function newWorkBook(): XLSX.WorkBook {
  return XLSX.utils.book_new();
}

export function appendSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  dataColumns: string[],
  data: any[]
): XLSX.WorkBook {
  const ws = XLSX.utils.aoa_to_sheet([dataColumns, ...data]);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return wb;
}

export function finalizeAndCreate(
  wb: XLSX.WorkBook,
  writingOptions?: WritingOptions
) {
  return XLSX.write(wb, {
    type: 'buffer',
    bookType: 'xlsx',
    ...writingOptions,
  });
}
