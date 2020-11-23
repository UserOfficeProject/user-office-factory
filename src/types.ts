export type MetaBase = { collectionFilename: string; singleFilename: string };
export type XLSXMetaBase = MetaBase & { columns: string[] };

export type ProposalXLSXData = Array<string | number>;
export type SEPXLSXData = Array<{
  sheetName: string;
  rows: Array<string | number>;
}>;

export type ProposalPDFData = {
  proposal: Proposal;
  questionarySteps: QuestionaryStep[];
  principalInvestigator: BasicUser;
  coProposers: BasicUser[];
  attachmentIds: string[];
  samples: ProposalSampleData[];
  technicalReview?: {
    status: string;
    timeAllocation: number;
    publicComment: string;
  };
};

export type SamplePDFData = {
  sample: Sample & { status: string };
  sampleQuestionaryFields: Answer[];
  attachmentIds: string[];
};

export type ProposalSampleData = Pick<
  SamplePDFData,
  'sample' | 'sampleQuestionaryFields'
>;

export interface Proposal {
  id: number;
  title: string;
  abstract: string;
  proposerId: number;
  statusId: number;
  created: Date;
  updated: Date;
  shortCode: string;
  rankOrder: number;
  finalStatus: number; // Should use ProposalEndStatus enum here
  callId: number;
  questionaryId: number;
  commentForUser: string;
  commentForManagement: string;
  notified: boolean;
  submitted: boolean;
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
  questionTemplateRelation: QuestionTemplateRelation;
  value?: any;
}

export interface BasicUser {
  id: number;
  firstname: string;
  lastname: string;
  organisation: string;
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
  PENDING_EVALUTATION = 0,
  LOW_RISK,
  ELEVATED_RISK,
  HIGH_RISK,
}
