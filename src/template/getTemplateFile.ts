import { readFile } from 'fs/promises';
import { join } from 'path';

const templatesFolder = join(__dirname, '..', '..', 'templates');
const fileCache: { [key: string]: string } = {};

// Instead of reading the files every time, we cache the content
export async function getTemplateFile(file: string): Promise<string> {
  const filePath = join(templatesFolder, file);

  if (fileCache[filePath]) {
    return fileCache[filePath];
  }

  const content = await readFile(filePath, 'utf-8');
  fileCache[filePath] = content;

  return content;
}
