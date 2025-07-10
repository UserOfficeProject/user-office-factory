export type MetaBase = { collectionFilename: string; singleFilename: string };
export type XLSXMetaBase = MetaBase & { columns: string[] };

export type ProposalXLSXData = Array<string | number>;
export type FapXLSXData = Array<{
  sheetName: string;
  rows: Array<string | number>;
}>;

export type Attachment = { id: string; figure?: string; caption?: string };

export type PdfTemplate = {
  templateData: string;
  templateHeader: string;
  templateFooter: string;
  templateSampleDeclaration: string;
};

export type FullProposalPDFData = {
  proposal: Proposal;
  questionarySteps: QuestionaryStep[];
  principalInvestigator: BasicUser;
  coProposers: BasicUser[];
  attachments: Attachment[];
  samples: ProposalSampleData[];
  genericTemplates: GenericTemplate[];
  technicalReviews: {
    status: string;
    timeAllocation: number;
    publicComment: string;
    instrumentName: string;
  }[];
  fapReviews?: Review[];
  pdfTemplate: PdfTemplate | null;
  type: 'full';
};

export type PregeneratedProposalPDFData = {
  proposal: Pick<Proposal, 'created' | 'primaryKey' | 'proposalId' | 'fileId'>;
  principalInvestigator: BasicUser;
  type: 'pregenerated';
};

export type ProposalPDFData = FullProposalPDFData | PregeneratedProposalPDFData;

export type SamplePDFData = {
  sample: Sample & { status: string };
  sampleQuestionaryFields: Answer[];
  attachments: Attachment[];
};

export type ShipmentPDFData = {
  shipment: Shipment;
};

export type ProposalSampleData = Pick<
  SamplePDFData,
  'sample' | 'sampleQuestionaryFields'
>;

export interface Proposal {
  primaryKey: number;
  title: string;
  abstract: string;
  proposerId: number;
  statusId: number;
  created: Date;
  updated: Date;
  proposalId: string;
  rankOrder: number;
  finalStatus: number; // Should use ProposalEndStatus enum here
  callId: number;
  questionaryId: number;
  commentForUser: string;
  commentForManagement: string;
  notified: boolean;
  submitted: boolean;
  fileId: string;
}

export interface Review {
  id: number;
  proposalPk: number;
  userID: number;
  comment: string;
  grade: number;
  status: number;
  fapID: number;
}

export interface Topic {
  id: number;
  title: string;
  templateId: number;
  sortOrder: number;
  isEnabled: boolean;
}

export interface QuestionaryStep {
  topic: Topic;
  isCompleted: boolean;
  fields: Answer[];
}

export interface FieldDependency {
  questionId: string;
  dependencyId: string;
  dependencyNaturalKey: string;
  condition: FieldCondition;
}

export interface FieldCondition {
  condition: any;
  params: any;
}

export enum TemplateCategoryId {
  PROPOSAL_QUESTIONARY = 1,
  SAMPLE_DECLARATION,
}

export interface Question {
  categoryId: TemplateCategoryId;
  proposalQuestionId: string;
  naturalKey: string;
  dataType: any;
  question: string;
  config: any;
}

export interface QuestionTemplateRelation {
  question: Question;
  topicId: number;
  sortOrder: number;
  config: any;
  dependency?: FieldDependency;
}

export interface Answer extends QuestionTemplateRelation {
  answerId: number;
  value?: GenericTemplateAnswer | any;
}

export interface BasicUser {
  id: number;
  firstname: string;
  lastname: string;
  institution: string;
  position: string;
  created: Date;
  placeholder: boolean;
}

export interface Sample {
  id: number;
  title: string;
  creatorId: number;
  questionaryId: number;
  safetyStatus: SampleStatus;
  safetyComment: string;
  created: Date;
}

export enum SampleStatus {
  PENDING_EVALUATION = 0,
  LOW_RISK,
  ELEVATED_RISK,
  HIGH_RISK,
}

export class Shipment {
  constructor(
    public id: number,
    public title: string,
    public creatorId: number,
    public proposalPk: number,
    public questionaryId: number,
    public status: ShipmentStatus,
    public externalRef: string,
    public created: Date,
    public proposalId: string,
    public callShortCode: string,
    public instrumentShortCodes: string,
    public weight: number,
    public width: number,
    public height: number,
    public length: number,
    public storageTemplerature: string,
    public isFragile: boolean,
    public isDangerous: boolean,
    public localContact: string
  ) {}
}

export enum ShipmentStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
}

export interface GenericTemplateInfo {
  id: number;
  title: string;
  creatorId: number;
  questionaryId: number;
  questionId: string;
  created: Date;
}

export interface GenericTemplate {
  genericTemplate: GenericTemplateInfo;
  genericTemplateQuestionaryFields: Answer[];
}

export interface GenericTemplateAnswer {
  questionId: string;
  questionaryId: number;
}

export interface Role {
  shortCode: string;
  title: string;
  id: number;
}
