import { SafeString } from 'handlebars';

import {
  Answer,
  GenericTemplate,
  GenericTemplateAnswer,
  ProposalPDFData,
} from '../../../types';

/**
 * Extracts a usable value from an answer.
 */
type ValueExtractor = (
  data: ProposalPDFData,
  questionaryStep: Answer
) => unknown;

/**
 * Extracts the answers into a map of question natural key to answer value.
 *
 * @param data The proposal PDF data to be mapped.
 */
export function extractAnswerMap(data: ProposalPDFData) {
  return data.questionarySteps
    .flatMap((questionaryStep) => questionaryStep.fields)
    .flatMap((answer) => ({
      key: answer.question.naturalKey,
      value: getValueExtractor(answer.question.dataType)(data, answer),
    }))
    .reduce((p: Record<string, unknown>, v) => {
      p[v.key] = v.value;

      return p;
    }, {});
}

/**
 * A function to make the value handlers more usable.
 *
 * @type The question type.
 * @returns The value extractor for the question type.
 */
function getValueExtractor(type: string): ValueExtractor {
  const valueExtractors: Record<string, ValueExtractor> = {
    GENERIC_TEMPLATE: (data, q) => extractGenericTemplateAnswerMap(data, q),
    RICH_TEXT_INPUT: (_, q) => new SafeString(q.value),
    DATE: (_, q) => dateTransformer(_, q),
  };
  const handler = valueExtractors[type];
  if (handler === undefined) {
    return (_, q) => q.value;
  } else {
    return valueExtractors[type];
  }
}

/**
 * Extracts an array map of questions to answers from a generic template.
 *
 * @param data The global proposal data containing the generic template answers.
 * @param answer The generic template answers.
 * @returns An array of mapped question natural keys to answers for a generic
 * template answer.
 */
function extractGenericTemplateAnswerMap(
  data: ProposalPDFData,
  answer: Answer
): Record<string, unknown>[] {
  return answer.value
    .map((a: GenericTemplateAnswer) =>
      data.genericTemplates.find(
        (g) =>
          g.genericTemplate.questionaryId === a.questionaryId &&
          g.genericTemplate.questionId === a.questionId
      )
    )
    .map((g: GenericTemplate) =>
      g.genericTemplateQuestionaryFields
        .map((answer) => {
          if (answer.question.dataType === 'GENERIC_TEMPLATE_BASIS') {
            return {
              key: 'generic_template_basis',
              value: g.genericTemplate.title,
            };
          } else {
            return {
              key: answer.question.naturalKey,
              value: getValueExtractor(answer.question.dataType)(data, answer),
            };
          }
        })
        .reduce((p: Record<string, unknown>, v) => {
          p[v.key] = v.value;

          return p;
        }, {})
    );
}

function dateTransformer(_: ProposalPDFData, answer: Answer) {
  const date = new Date(answer.value);

  return answer.config.includeTime
    ? date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
    : date.toLocaleDateString();
}
