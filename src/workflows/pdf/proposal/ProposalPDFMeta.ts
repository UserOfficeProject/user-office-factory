import { FileMetadata } from '../../../models/File';
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
  attachmentsFileMeta: FileMetadata[];
  attachments: Attachment[];
};

export type ProposalCountedPagesMeta =
  PdfFactoryCountedPagesMeta<ProposalPDFMeta>;
