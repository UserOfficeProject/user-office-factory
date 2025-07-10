import { FileMetadata } from '../../../models/File';
import { TableOfContents } from '../../../pdf';
import { Attachment } from '../../../types';

export type FullProposalPDFMeta = {
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
  type: 'full';
};

export type PregeneratedProposalPDFMeta = {
  files: {
    proposal: string;
  };
  type: 'pregenerated';
};

export type ProposalPDFMeta = FullProposalPDFMeta | PregeneratedProposalPDFMeta;
