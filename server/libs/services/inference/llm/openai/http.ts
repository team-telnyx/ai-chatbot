import {
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
  ChatCompletionToolChoiceOption,
} from 'openai/resources/index.js';

import { OpenAI } from './openai.js';
import { APIError } from 'openai';
import { Threads } from '../../../../repositories/postgres/threads.postgres.js';
import { OpenAIModel, OpenAIRequest, OpenAIRequestConfiguration, OpenAIResponse } from '../../types.js';

type TelnyxChatCompletionCreateParamsNonStreaming = ChatCompletionCreateParamsNonStreaming & { openai_api_key: string };

export class OpenAIHTTP extends OpenAI {
  constructor({ client, tools, conditional_tools }) {
    super({ client, tools, conditional_tools });
  }

  public async call(
    configuration: OpenAIRequestConfiguration,
    request: OpenAIRequest,
    database: Threads,
    tool_choice: ChatCompletionToolChoiceOption = null,
    model: OpenAIModel | null = null
  ): Promise<OpenAIResponse> {
    this.setupCall(configuration, request, database);
    this.request.type = 'http';

    console.log('\nHttp.ts Call:', { tool_choice: tool_choice || 'auto', model: model || 'gpt-4' });

    try {
      const config: TelnyxChatCompletionCreateParamsNonStreaming = {
        max_tokens: configuration.max_tokens,
        temperature: configuration.temperature,
        messages: configuration.messages as ChatCompletionMessageParam[],
        model: model ? `openai/${model}` : `openai/${configuration.model}`,
        tools: this.tool_list,
        openai_api_key: process.env.OPENAI_API_KEY,
        tool_choice: !this.tool_list ? undefined : ((tool_choice || 'auto') as ChatCompletionToolChoiceOption),
        response_format: this.request.response_format,
      };

      const data = await this.client.chat.completions.create(config);
      const usage = data.usage;

      const choice = data.choices[0];
      const answer = choice.message.content;
      const finish_reason = choice.finish_reason;

      if (finish_reason === 'tool_calls' || choice?.message?.tool_calls) {
        const { name, arguments: args } = data.choices[0].message.tool_calls?.[0]?.function;

        this.tool = this.tools.find((x) => x.name === name);
        this.tool.arguments = args;

        return this.runTool();
      }

      // store in the database if the request succeeded
      if (!this.execution_error) {
        this.request.prompt_tokens = usage.prompt_tokens;
        this.request.completion_tokens = usage.completion_tokens;
        this.request.answer = answer;

        if (request.save_thread) {
          try {
            if (this.database) this.database.store();
          } catch (e) {
            console.log('Failed to store request in database', e?.message || 'An unexpected error occured.');
          }
        }
      }

      // return { id, answer, usage, finish_reason };
      return this.request;
    } catch (e) {
      if (e instanceof APIError) {
        console.error(e.status);
        console.error(e.message);
        console.error(e.code);
        console.error(e.type);

        return this.error(e?.message || 'An unexpected error occured.', 'initiate');
      }

      try {
        return this.error(e?.toJSON()?.message || 'An unexpected error occured.', 'initiate');
      } catch (err) {
        return this.error('An unexpected error occured.', 'initiate');
      }
    }
  }
}
