const template = `
<p>Custom template
<p>Proposal title: {{ proposal.title }}
<p>Proposal ID: {{ proposal.proposalId }}
<p>PI: {{ principalInvestigator.firstname }} {{ principalInvestigator.lastname }} {{ principalInvestigator.institution }} {{ principalInvestigator.position }}
<p>CoIs:
{{#each coProposers}}
  {{ firstname }} {{ lastname }} ({{institution}}){{#unless @last}},{{/unless}}
{{/each}}

<p>Boolean question 1: {{ answers.boolean_1 }}
<p>Boolean question 2: {{ answers.boolean_2 }}

<p>Selection from options: {{ answers.selection_from_options_1 }}
<p>Selection from options with multiple select:
{{#each answers.selection_from_options_2}}
  {{.}}{{#unless @last}},{{/unless}}
{{/each}}

<p>Interval question 1:
  {{ answers.interval_1.min }} to {{ answers.interval_1.max }}
  {{ answers.interval_1.unit }}
<p>Interval question 2:
  {{ answers.interval_2.min }} to {{ answers.interval_2.max }}
  {{ answers.interval_2.unit }}
<p>Interval question 3:
  {{ answers.interval_3.min }} to {{ answers.interval_3.max }}
  {{ answers.interval_3.unit }}

<p>Random question: {{ answers.unknown_datatype_1 }}

<p>Rich text: {{ answers.rich_text_input_1 }}

<p>Number input 1: {{ answers.number_input_1.value }} {{ answers.number_input_1.unit }}
<p>Number input 2: {{ answers.number_input_2.value }} {{ answers.number_input_2.unit }}
<p>Number input 3: {{ answers.number_input_3.value }} {{ answers.number_input_3.unit }}

<div>
  Generic template:
  {{#each answers.generic_template_1234_nk}}
    <p>
    {{ generic_template_basis }}
    {{ generic_text_input_1 }}
  {{/each}}
</div>

<p>Extra line for tests
`;

const header = `
<div>
  Header
</div>
`;

const footer = `
<div>
  Footer
</div>
`;

export default {
  proposal_test_1: [
    {
      samples: [],
      technicalReview: {
        status: 'Okey',
        timeAllocation: 30,
        publicComment: 'Technical review lorem ipsum',
        instrumentName: 'Instrument 1',
      },
      proposal: {
        id: 1,
        title: 'Test proposal',
        proposalId: '123123',
        abstract: 'First lorem ipsum',
      },
      principalInvestigator: {
        firstname: 'Foo',
        lastname: 'Bar',
        institution: 'Baz',
        position: 'Foobar',
      },
      coProposers: [
        {
          firstname: 'Co Foo 1',
          lastname: 'Co Bar 1',
          institution: 'Co Baz 1',
        },
        {
          firstname: 'Co Foo 2',
          lastname: 'Co Bar 2',
          institution: 'Co Baz 2',
        },
      ],
      attachments: [],
      questionarySteps: [
        {
          topic: {
            title: 'Questionary 1',
          },
          fields: [
            {
              question: {
                naturalKey: 'embelishment_1',
                dataType: 'EMBELLISHMENT',
              },
              config: {
                plain: 'Visible EMBELLISHMENT',
                omitFromPdf: false,
              },
            },
            {
              question: {
                dataType: 'EMBELLISHMENT',
                naturalKey: 'embelishment_2',
              },
              config: {
                plain: 'Hidden EMBELLISHMENT',
                omitFromPdf: true,
              },
            },
            {
              question: {
                dataType: 'DATE',
                question: 'Date question',
                naturalKey: 'date_1',
              },
              config: {
                includeTime: true,
              },
              value: '2020-10-27T15:06:23.849Z',
            },
            {
              question: {
                dataType: 'BOOLEAN',
                question: 'Boolean question - true',
                naturalKey: 'boolean_1',
              },
              value: true,
            },
            {
              question: {
                dataType: 'BOOLEAN',
                question: 'Boolean question - false',
                naturalKey: 'boolean_2',
              },
              value: false,
            },
            {
              question: {
                dataType: 'SELECTION_FROM_OPTIONS',
                question: 'Selection from options',
                naturalKey: 'selection_from_options_1',
              },
              value: ['Selected answer'],
            },
            {
              question: {
                dataType: 'SELECTION_FROM_OPTIONS',
                question: 'Selection from options with multiple select',
                naturalKey: 'selection_from_options_2',
              },
              value: ['foo', 'bar'],
            },
            {
              question: {
                dataType: 'INTERVAL',
                question: 'Interval question',
                naturalKey: 'interval_1',
              },
              value: {
                min: -1,
                max: 99,
                unit: { unit: 'foo' },
              },
            },
            {
              question: {
                dataType: 'INTERVAL',
                question: 'Interval question - no answer',
                naturalKey: 'interval_2',
              },
              value: {
                min: '',
                max: '',
                unit: null,
              },
            },
            {
              question: {
                dataType: 'INTERVAL',
                question: 'Interval question - no unit',
                naturalKey: 'interval_3',
              },
              value: {
                min: '1',
                max: '2',
                unit: null,
              },
            },
            {
              question: {
                dataType: 'RICH_TEXT_INPUT',
                question: 'Rich text input question',
                naturalKey: 'rich_text_input_1',
              },
              value: '<p>rich</p>\n<p>text</p>\n<p>input</p>',
            },
            {
              question: {
                dataType: 'NUMBER_INPUT',
                question: 'Number input question',
                naturalKey: 'number_input_1',
              },
              value: {
                unit: 'foo/bar',
                value: '2345',
              },
            },
            {
              question: {
                dataType: 'NUMBER_INPUT',
                question: 'Number input question - no answer',
                naturalKey: 'number_input_2',
              },
              value: {
                unit: 'foo/bar',
                value: '',
              },
            },
            {
              question: {
                dataType: 'NUMBER_INPUT',
                question: 'Number input question - no unit',
                naturalKey: 'number_input_3',
              },
              value: {
                unit: null,
                value: '2345',
              },
            },
            {
              question: {
                dataType: 'Unknown dataType',
                question: 'Random question',
                naturalKey: 'unknown_datatype_1',
              },
              value: 'Random answer',
            },
            {
              question: {
                id: 'generic_template_1234',
                dataType: 'GENERIC_TEMPLATE',
                question: 'Generic template main question',
                questionId: 'generic_template_1234',
                naturalKey: 'generic_template_1234_nk',
              },
              value: [
                {
                  title: 'Generic template answer #1',
                  questionId: 'generic_template_1234',
                  questionaryId: 1,
                },
                {
                  title: 'Generic template answer #1',
                  questionId: 'generic_template_1234',
                  questionaryId: 2,
                },
              ],
            },
          ],
        },
      ],
      genericTemplates: [
        {
          genericTemplate: {
            title: 'Generic template basis answer',
            questionId: 'generic_template_1234',
            questionaryId: 1,
          },
          genericTemplateQuestionaryFields: [
            {
              question: {
                dataType: 'GENERIC_TEMPLATE_BASIS',
              },
              config: {
                questionLabel: 'Generic template basis question',
              },
            },
            {
              question: {
                dataType: 'TEXT_INPUT',
                question: 'Text question 2',
                questionId: 'generic_text_input_1',
                naturalKey: 'generic_text_input_1',
              },
              value: 'Text answer 2',
            },
          ],
        },
        {
          genericTemplate: {
            title: 'Generic template basis answer',
            questionId: 'generic_template_1234',
            questionaryId: 2,
          },
          genericTemplateQuestionaryFields: [
            {
              question: {
                dataType: 'GENERIC_TEMPLATE_BASIS',
              },
              config: {
                questionLabel: 'Generic template basis question',
              },
            },
            {
              question: {
                dataType: 'TEXT_INPUT',
                question: 'Text question 2',
                questionId: 'generic_text_input_1',
                naturalKey: 'generic_text_input_1',
              },
              value: 'Text answer 3',
            },
          ],
        },
      ],
      pdfTemplate: {
        templateData: template,
        templateHeader: header,
        templateFootyer: footer,
      },
      fapReviews: [],
    },
  ],
};
