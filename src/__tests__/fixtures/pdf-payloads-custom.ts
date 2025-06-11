const proposalTemplate = `
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
  {{ answers.interval_1.unit.unit }}
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

const proposalHeader = `
<div>
  Header
</div>
`;

const proposalFooter = `
<div>
  Footer
</div>
`;

const experimentSafetyTemplate = `
<h3>Experiment Risk Assessment - Custom Template</h3>

<p>Experiment ID: {{ experiment.experimentId }}</p>
<p>Time Period: {{ $readableDate experiment.startsAt }} - {{ $readableDate experiment.endsAt }}</p>
<p>PI: {{ principalInvestigator.firstname }} {{ principalInvestigator.lastname }}</p>
<p>Institution: {{ principalInvestigator.institution }}</p>
<p>Proposal ID: {{ proposal.proposalId }}</p>

{{#if ($eq experimentSafety.statusId '21')}}
  <p>Status: <strong>Approved</strong></p>
{{else if ($eq experimentSafety.statusId '20')}}
  <p>Status: <strong>Rejected</strong></p>
{{/if}}

<h4>Safety Review Information</h4>

<p>Hazard Type: {{ safetyReviewQuestionary.answers.hazard_type_selection }}</p>
<p>Hazard Category: {{ safetyReviewQuestionary.answers.hazard_category_selection }}</p>
<p>Activity of nuclides (Bq): {{ safetyReviewQuestionary.answers.number_input_1748000383113.value }}</p>
<p>Dose rate (uSv/Hr): {{ safetyReviewQuestionary.answers.number_input_1748000403569.value }}</p>
<p>Containment: {{ safetyReviewQuestionary.answers.selection_from_options_1748000429923 }}</p>
<p>Facility Internal Code: {{ safetyReviewQuestionary.answers.text_input_1748000472287 }}</p>

<h4>Disposal Information</h4>
<p>Disposal: {{ safetyReviewQuestionary.answers.text_input_1748000538044 }}</p>

<h4>Transport Information</h4>
<p>UN: {{ safetyReviewQuestionary.answers.text_input_1748000566303 }}</p>

<h4>Experimenter Input</h4>
<p>Potential hazards: {{ esiQuestionary.answers.text_input_1731936230475 }}</p>

<h4>Sample Information</h4>
{{#each experimentSamples}}
  <p>Sample: {{ this.sample.title }}</p>
  <p>Radioactive hazards: {{#if this.sampleESIQuestionary.answers.boolean_1602681963527}}Yes{{else}}No{{/if}}</p>
  <p>10 Tesla Magnet: {{#if this.sampleESIQuestionary.answers.boolean_1602773459215}}Yes{{else}}No{{/if}}</p>
  <p>Sample details: {{ this.sampleESIQuestionary.answers.text_input_1602681978151 }}</p>
  <p>Total samples: {{ this.sampleESIQuestionary.answers.text_input_1603713538053 }}</p>
{{/each}}

<h4>Review Decision</h4>
<p>Review Decision: {{#if ($eq experimentSafety.experimentSafetyReviewerDecision 1)}}Approved{{else}}Rejected{{/if}}</p>
<p>Review Comment: {{ experimentSafety.experimentSafetyReviewerComment }}</p>
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
        templateData: proposalTemplate,
        templateHeader: proposalHeader,
        templateFootyer: proposalFooter,
      },
      fapReviews: [],
    },
  ],
  experiment_safety_test_1: [
    {
      proposal: {
        primaryKey: 5,
        title: 'Test Experiment',
        abstract: 'Test abstract for experiment safety',
        proposerId: 2,
        statusId: 8,
        created: '2025-05-23T11:23:56.934Z',
        updated: '2025-05-23T11:32:28.493Z',
        proposalId: 'TEST-123',
        finalStatus: 1,
        callId: 36,
        questionaryId: 48,
        commentForUser: '',
        commentForManagement: '',
        notified: false,
        submitted: true,
        referenceNumberSequence: 0,
        managementDecisionSubmitted: true,
        submittedDate: '2025-05-23T11:28:54.816Z',
        experimentSequence: 2,
      },
      principalInvestigator: {
        id: 2,
        firstname: 'John',
        lastname: 'Smith',
        preferredname: 'Johnny',
        institution: 'Test University',
        institutionId: 1,
        position: 'Researcher',
        created: '2025-05-12T09:41:03.374Z',
        placeholder: false,
        email: 'jsmith@example.com',
      },
      experiment: {
        experimentPk: 2,
        experimentId: 'TEST-123-1',
        startsAt: '2025-05-25T07:00:00.000Z',
        endsAt: '2025-05-26T07:00:00.000Z',
        scheduledEventId: 40,
        proposalPk: 5,
        status: 'ACTIVE',
        localContactId: null,
        instrumentId: 1,
        createdAt: '2025-05-23T11:32:28.493Z',
        updatedAt: '2025-05-23T11:32:28.493Z',
        referenceNumberSequence: 1,
      },
      experimentSafety: {
        experimentSafetyPk: 4,
        experimentPk: 2,
        esiQuestionaryId: 52,
        esiQuestionarySubmittedAt: '2025-05-23T11:36:51.473Z',
        createdBy: 2,
        statusId: 21,
        safetyReviewQuestionaryId: 54,
        reviewedBy: 2,
        createdAt: '2025-05-23T11:33:34.356Z',
        updatedAt: '2025-05-23T11:52:56.809Z',
        instrumentScientistDecision: null,
        instrumentScientistComment: null,
        experimentSafetyReviewerDecision: 1,
        experimentSafetyReviewerComment:
          'Test safety review comment for experiment approval.',
      },
      esiQuestionary: {
        questionarySteps: [
          {
            questionaryId: 52,
            topic: {
              id: 37,
              title: 'New experiment safety input',
              templateId: 35,
              isEnabled: true,
            },
            isCompleted: true,
            fields: [
              {
                question: {
                  id: 'proposal_esi_basis',
                  dataType: 'PROPOSAL_ESI_BASIS',
                  question: 'Proposal ESI basis',
                },
                value: null,
              },
              {
                question: {
                  id: 'text_input_1731936230475',
                  dataType: 'TEXT_INPUT',
                  question:
                    'Is there any other hazards that could be expected at the experiment site?',
                },
                value:
                  'Yes, potential hazards include electrical, chemical, and radiation risks. Safety measures required.',
              },
            ],
          },
        ],
        answers: {
          proposal_esi_basis: null,
          text_input_1731936230475:
            'Yes, several potential hazards may be present at the experiment site depending on the setup. These include electrical hazards from equipment, chemical exposure from spills or fumes, and biological risks if handling microorganisms. Mechanical injuries from tools, fire hazards from flammable materials, or radiation exposure may also occur. Additionally, slips, trips, and falls due to cluttered or wet areas are possible. Poor ventilation, extreme temperatures, or noise could impact safety. A comprehensive risk assessment must be conducted beforehand to identify and mitigate these hazards. Proper training, protective equipment, and emergency procedures should be in place to ensure a safe environment.',
        },
      },
      safetyReviewQuestionary: {
        questionarySteps: [
          {
            questionaryId: 54,
            topic: {
              id: 4,
              title: 'Hazards',
              templateId: 4,
              isEnabled: true,
            },
            isCompleted: true,
            fields: [
              {
                question: {
                  id: 'exp_safety_review_basis',
                  dataType: 'EXP_SAFETY_REVIEW_BASIS',
                  question: 'Experiment Safety review basic information',
                },
                value: null,
              },
              {
                question: {
                  id: 'number_input_1748000383113',
                  dataType: 'NUMBER_INPUT',
                  question: 'Activity of nuclides (Bq)',
                },
                value: {
                  unit: null,
                  value: 1,
                  siValue: 1,
                },
              },
              {
                question: {
                  id: 'number_input_1748000403569',
                  dataType: 'NUMBER_INPUT',
                  question: 'Dose rate (uSv/Hr):',
                },
                value: {
                  unit: null,
                  value: 1,
                  siValue: 1,
                },
              },
              {
                question: {
                  id: 'selection_from_options_1748000429923',
                  dataType: 'SELECTION_FROM_OPTIONS',
                  question: 'Containment',
                },
                value: ['Cold Box'],
              },
              {
                question: {
                  id: 'text_input_1748000472287',
                  dataType: 'TEXT_INPUT',
                  question: 'Facility Internal Code',
                },
                value: 'BIO-FAC-12A',
              },
              {
                question: {
                  id: 'selection_from_options_1748001057358',
                  dataType: 'SELECTION_FROM_OPTIONS',
                  question: 'Hazard Category',
                },
                value: ['HIGH'],
              },
              {
                question: {
                  id: 'selection_from_options_1748001098877',
                  dataType: 'SELECTION_FROM_OPTIONS',
                  question: 'Hazard Type',
                },
                value: ['Radioactive'],
              },
            ],
          },
          {
            questionaryId: 54,
            topic: {
              id: 55,
              title: 'Disposal/Removal',
              templateId: 4,
              isEnabled: true,
            },
            isCompleted: true,
            fields: [
              {
                question: {
                  id: 'text_input_1748000538044',
                  dataType: 'TEXT_INPUT',
                  question: 'How is the Displosal being handled?',
                },
                value:
                  'Disposal is managed in accordance with safety and environmental regulations. All waste materials are categorized, labeled, and stored properly before being collected by certified disposal services. Hazardous substances are handled with special procedures to prevent contamination. Regular audits ensure compliance with disposal protocols and proper documentation is maintained.',
              },
            ],
          },
          {
            questionaryId: 54,
            topic: {
              id: 56,
              title: 'Transport Information',
              templateId: 4,
              isEnabled: true,
            },
            isCompleted: true,
            fields: [
              {
                question: {
                  id: 'text_input_1748000566303',
                  dataType: 'TEXT_INPUT',
                  question: 'UN',
                },
                value: '1234',
              },
            ],
          },
        ],
        answers: {
          exp_safety_review_basis: null,
          number_input_1748000383113: {
            unit: null,
            value: 1,
            siValue: 1,
          },
          number_input_1748000403569: {
            unit: null,
            value: 1,
            siValue: 1,
          },
          selection_from_options_1748000429923: ['Cold Box'],
          text_input_1748000472287: 'TEST-123',
          hazard_category_selection: ['HIGH'],
          hazard_type_selection: ['Hot'],
          text_input_1748000538044:
            'Disposal follows standard safety protocols with proper handling procedures.',
          rich_text_input_1748249172725:
            '<p><em><strong>Test rich text</strong></em></p>',
          text_input_1748000566303: '5678',
        },
      },
      instrument: {
        id: 1,
        name: 'Test Instrument',
        shortCode: 'TEST-INST',
        description: 'Test instrument for safety experiments',
        managerUserId: 2,
      },
      localContact: null,
      experimentSamples: [
        {
          experimentSample: {
            experimentPk: 2,
            sampleId: 4,
            isEsiSubmitted: true,
            sampleEsiQuestionaryId: 53,
            createdAt: '2025-05-23T11:33:37.774Z',
            updatedAt: '2025-05-23T11:33:37.774Z',
          },
          sample: {
            id: 4,
            title: 'Test Sample',
            creatorId: 2,
            proposalPk: 5,
            questionaryId: 50,
            questionId: 'sample_declaration_1747832567995',
            isPostProposalSubmission: false,
            safetyStatus: 0,
            safetyComment: '',
            created: '2025-05-23T11:27:57.958Z',
            shipmentId: null,
          },
          sampleESIQuestionary: {
            questionarySteps: [
              {
                questionaryId: 53,
                topic: {
                  id: 38,
                  title: 'New experiment safety input',
                  templateId: 36,
                  isEnabled: true,
                },
                isCompleted: true,
                fields: [
                  {
                    question: {
                      id: 'sample_esi_basis',
                      dataType: 'SAMPLE_ESI_BASIS',
                      question: 'Sample ESI basic information',
                    },
                    value: null,
                  },
                  {
                    question: {
                      id: 'boolean_1602681963527',
                      dataType: 'BOOLEAN',
                      question:
                        'Are there any Radioactive hazards associated with your sample?',
                    },
                    value: true,
                  },
                  {
                    question: {
                      id: 'embellishment_1601536727146',
                      dataType: 'EMBELLISHMENT',
                      question: 'New question',
                    },
                    value: null,
                  },
                  {
                    question: {
                      id: 'boolean_1602773459215',
                      dataType: 'BOOLEAN',
                      question: '10 Tesla Magnet',
                    },
                    value: true,
                  },
                  {
                    question: {
                      id: 'boolean_1747832636160',
                      dataType: 'BOOLEAN',
                      question: 'Yes/No',
                    },
                    value: true,
                  },
                  {
                    question: {
                      id: 'text_input_1602681978151',
                      dataType: 'TEXT_INPUT',
                      question: 'Please give more details (max 100 characters)',
                    },
                    value: 'Test sample details for experiment',
                  },
                  {
                    question: {
                      id: 'text_input_1603713538053',
                      dataType: 'TEXT_INPUT',
                      question: 'Total number of the same sample',
                    },
                    value: '23',
                  },
                  {
                    question: {
                      id: 'text_input_1603713303928',
                      dataType: 'TEXT_INPUT',
                      question: 'Please give details',
                    },
                    value: 'Test sample material',
                  },
                  {
                    question: {
                      id: 'boolean_1602682083541',
                      dataType: 'BOOLEAN',
                      question: 'Is your sample sensitive to water vapour?',
                    },
                    value: true,
                  },
                  {
                    question: {
                      id: 'boolean_1602773488341',
                      dataType: 'BOOLEAN',
                      question: 'Water Bath',
                    },
                    value: false,
                  },
                ],
              },
            ],
            answers: {
              sample_esi_basis: null,
              boolean_1602681963527: true,
              embellishment_1601536727146_sample: null,
              boolean_1602773459215: true,

              boolean_1747832636160: true,
              text_input_1602681978151:
                'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat',
              text_input_1603713538053: '23',
              text_input_1603713303928:
                'Lorem ipsum dolor sit amet consectetur adipiscing elit. Quisque faucibus ex sapien vitae pellentesque sem placerat',
              boolean_1602682083541: true,
              boolean_1602773488341: false,
            },
          },
          attachments: [],
        },
      ],
      attachments: [],
      pdfTemplate: {
        templateData: experimentSafetyTemplate,
        templateHeader: '',
        templateFootyer: '',
      },
    },
  ],
};
