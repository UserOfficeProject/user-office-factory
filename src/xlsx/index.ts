import XLSX, { WritingOptions } from 'xlsx';

export function writeToSheet(
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
