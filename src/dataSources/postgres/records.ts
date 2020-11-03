import { FileMetadata } from '../../models/File';

export interface FileRecord {
  readonly file_id: string;
  readonly file_name: string;
  readonly size_in_bytes: number;
  readonly mime_type: string;
  readonly oid: number;
  readonly created_at: Date;
}

export const createFileMetadata = (record: FileRecord) => {
  return new FileMetadata(
    record.file_id,
    record.oid,
    record.file_name,
    record.mime_type,
    record.size_in_bytes,
    record.created_at
  );
};
