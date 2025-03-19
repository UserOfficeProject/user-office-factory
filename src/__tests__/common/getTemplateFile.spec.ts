import { readFile } from 'fs/promises';
import { join } from 'path';

import { getTemplateFile } from '../../template/getTemplateFile';

jest.mock('fs/promises');

describe('getTemplateFile', () => {
  const mockReadFile = readFile as jest.MockedFunction<typeof readFile>;
  const templatesFolder = join(__dirname, '..', '..', '..', 'templates');
  const fileName = 'test.txt';
  const filePath = join(templatesFolder, fileName);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should read file content and cache it', async () => {
    const fileContent = 'file content';
    mockReadFile.mockResolvedValue(fileContent);

    let content = await getTemplateFile(fileName);

    expect(content).toBe(fileContent);

    content = await getTemplateFile(fileName);

    expect(content).toBe(fileContent);

    expect(mockReadFile).toHaveBeenCalledTimes(1);
    expect(mockReadFile).toHaveBeenCalledWith(filePath, 'utf-8');
  });
});
