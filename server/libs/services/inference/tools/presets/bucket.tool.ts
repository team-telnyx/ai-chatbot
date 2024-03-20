import { Indexes } from '../../../documents/types.js';
import { Tool } from '../tool.js';

export class ExampleBucketSearchTool extends Tool {
  constructor({ req }) {
    super({ req });

    this.name = 'get_bucket_data';
    this.description = 'Search for textual content in a Telnyx bucket';
  }

  public get define() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            search: {
              type: 'string',
              description: 'A search term for the bucket',
            },
          },
          required: ['search'],
        },
      },
    };
  }

  public async execute() {
    try {
      const args = JSON.parse(this.arguments);

      console.log('Execute:', { name: this.name, arguments: args });

      const search = args.search;
      if (!search) throw new Error('The LLM did not output a valid search term. Please try this request again.');

      const system = [
        'You are an intelligent assistant that just searched for Telnyx content.',
        'You should describe the content to the user. Keep your responses short.',
      ].join('\n');

      const indexes: Indexes[] = [
        { index: 'devdocs', weight: 1 },
        { index: 'dotcom', weight: 1 },
        { index: 'dotcom-blog', weight: 1 },
      ];

      const matches = await this.context.matches(search, indexes);
      const { context, used } = await this.context.prompt(matches);

      return this.response({
        system,
        tool_output: context,
        metadata: {
          result: 'bucket_response',
          show_feedback: true,
          show_help_action: false,
          used_documents: used,
        },
      });
    } catch (e) {
      return this.error(e);
    }
  }
}
