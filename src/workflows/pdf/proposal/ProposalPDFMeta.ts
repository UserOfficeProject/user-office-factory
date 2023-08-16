import { FileMetadata } from '../../../models/File';
import { TableOfContents } from '../../../pdf';
import { Attachment } from '../../../types';
import { PdfFactoryCountedPagesMeta } from '../PdfFactory';

export type ProposalPDFMeta = {
  files: {
    proposal: string;
    questionnaires: string[];
    samples: string[];
    genericTemplates: string[];
    attachments: string[];
    technicalReview: string;
  };
  toc: {
    proposal: TableOfContents[];
    questionnaires: TableOfContents[][];
    samples: TableOfContents[][];
    genericTemplates: TableOfContents[][];
    attachments: TableOfContents[][];
    technicalReview: TableOfContents[];
  };
  attachmentsFileMeta: FileMetadata[];
  attachments: Attachment[];
};

export type ProposalCountedPagesMeta =
  PdfFactoryCountedPagesMeta<ProposalPDFMeta>;
