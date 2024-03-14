/* eslint-disable @typescript-eslint/no-explicit-any */

import { Response } from 'express';
import { OpenAI } from './openai.js';
import { APIError } from 'openai';

import { Threads } from '../../../../repositories/postgres/threads.postgres.js';
import { OpenAIModel, OpenAIRequest, OpenAIRequestConfiguration } from '../../../../../types/classes/openai.js';
import { CallbackEvent } from '../../../../../types/common.js';
import {
  ChatCompletionChunk,
  ChatCompletionCreateParamsStreaming,
  ChatCompletionMessageParam,
  ChatCompletionToolChoiceOption,
} from 'openai/resources/index.js';

type TelnyxChatCompletionCreateParamsStreaming = ChatCompletionCreateParamsStreaming & { openai_api_key?: string };
export class OpenAIStream extends OpenAI {
  res: Response;

  constructor({ client, res, tools, conditional_tools }) {
    super({ client, tools, conditional_tools });

    this.res = res;
    this.callback = this.callbackResponse;
    this.close = this.closeConnection;
  }

  public async call(
    configuration: OpenAIRequestConfiguration,
    request: OpenAIRequest,
    database: Threads,
    tool_choice: ChatCompletionToolChoiceOption = null,
    model: OpenAIModel | null = null
  ): Promise<void> {
    this.setupCall(configuration, request, database);
    this.request.type = 'stream';

    const telnyxModel = model ? `openai/${model}` : `openai/${configuration.model}`;

    const tools = this.tool_list;
    const toolChoice = !this.tool_list ? undefined : tool_choice || 'auto';

    try {
      const config: TelnyxChatCompletionCreateParamsStreaming = {
        max_tokens: configuration.max_tokens,
        temperature: configuration.temperature,
        messages: configuration.messages as ChatCompletionMessageParam[],
        model: telnyxModel,
        tools: tools,
        tool_choice: toolChoice,
        stream: true as const,
        openai_api_key: process.env.OPENAI_API_KEY,
      };

      console.log('\nstream.ts Call:', { tool_choice: toolChoice, model: telnyxModel });

      const stream = await this.client.chat.completions.create(config);
      for await (const chunk of stream) {
        this.data(chunk);
      }

      this.end();
    } catch (error) {
      console.log('Failed during streaming', error);
      if (error instanceof APIError) {
        this.error(error.message || 'An unexpected error occured.', 'initiate');
      } else {
        this.error(error?.message || 'An unexpected error occured.', 'initiate');
        console.log(error);
      }
    }
  }

  /**
   * Stream handler for processing data chunks
   * @param chunk The chunk being processed
   */

  private data(data: ChatCompletionChunk): void {
    if (this.execution_error) return;

    try {
      const isTool = data?.choices?.[0].delta?.tool_calls?.[0]?.function;
      if (isTool) return this.stream_tool(data);

      const chunk = data.choices[0].delta;

      if (chunk?.content) {
        this.answer += chunk.content;
        this.completion_tokens += 1;

        this.callback({ type: 'token', value: chunk.content });
      }
    } catch (e) {
      const error = 'An unexpected error occured when processing the data chunk.';
      this.error(error, 'initiate');
    }
  }

  /**
   * A handler for when the stream has ended
   * This can create a new chat completion stream if an OpenAI function was called
   */

  private async end() {
    // if the stream was ended because of an error
    if (this.execution_error) return;

    // if the stream was ended because a function was called
    if (this.tool && this.tool_count <= 5) return this.runTool();

    // sending the completion duration event
    const completion_name = `${this.request.model} Completion`;
    const completion_duration = { name: completion_name, duration: (performance.now() - this.completion_start) / 1000 };
    this.callback({ type: 'timer', value: completion_duration });

    // sending the total duration as a separate event so it can be displayed in the UI
    const total_duration = { name: `Total Duration`, duration: (performance.now() - this.request.start) / 1000 };
    this.callback({ type: 'timer', value: total_duration });

    // sending the completion event
    this.callback({
      type: 'complete',
      value: JSON.stringify({
        show_help_action: this.request.metadata.show_help_action,
        show_feedback: this.request.metadata.show_feedback,
      }),
    });

    // updating the request
    this.request.prompt_tokens = this.prompt_tokens;
    this.request.completion_tokens = this.completion_tokens;
    this.request.answer = this.answer;

    try {
      if (this.database) this.database.store();
    } catch (e) {
      console.log('Failed to store request in database', e?.message || 'An unexpected error occured.');
    }

    this.close();
  }

  /**
   * A function for streaming function calls from the LLM
   * @param data A chunk of data from the OpenAI stream
   */

  private stream_tool(data: ChatCompletionChunk) {
    const tool_name = data.choices?.[0]?.delta?.tool_calls?.[0]?.function?.name;

    if (tool_name && !this.tool) {
      const tool = this.tools.find((x) => x.name === tool_name);
      if (!tool) throw new Error('The tool passed by the LLM does not exist.');

      // include tokens used to call function
      this.prompt_tokens += this.function_call_tokens(
        this.configuration.model,
        data.choices?.[0]?.delta?.tool_calls?.[0]?.function
      );
      this.tool = tool;
      return;
    }

    this.completion_tokens += 1;

    const argument_chunk = data.choices?.[0]?.delta?.tool_calls?.[0]?.function?.arguments;
    if (argument_chunk.trim() === '{' || argument_chunk.trim() === '{\n' || argument_chunk.trim() === '}') return;

    this.tool.arguments += argument_chunk;
  }

  /**
   * This is a helper function for streaming chunks to the client
   * @param event The event to stream to the client
   */

  public callbackResponse(event: CallbackEvent): void {
    this.res.write('data: ' + JSON.stringify(event) + '\n\n');
  }

  /**
   * Helper function for terminating the stream connection between the client and the backend
   */

  public closeConnection() {
    try {
      setTimeout(() => this.res.end(), 10);
    } catch (e) {}
  }
}
