import { FileMetadata } from '../../../models/File';
import { TableOfContents } from '../../../pdf';
import { Attachment } from '../../../types';
import { PdfFactoryCountedPagesMeta } from '../PdfFactory';

export type ExperimentSafetyPDFMeta = {
  files: {
    experimentSafety: string;
  };
  toc: {
    experimentSafety: TableOfContents[];
  };
  attachmentsFileMeta: FileMetadata[];
  attachments: Attachment[];
};

export type ExperimentSafetyCountedPagesMeta =
  PdfFactoryCountedPagesMeta<ExperimentSafetyPDFMeta>;
