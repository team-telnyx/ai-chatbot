import { LLM } from '../llm.js';
import { v4 as uuidv4 } from 'uuid';

import {
  OpenAIModel,
  OpenAIResponse,
  OpenAIRole,
  OpenAIRequest,
  OpenAIRequestConfiguration,
} from '../../../../../types/classes/openai.js';

import { CallbackEvent } from '../../../../../types/common.js';

import { APIError } from 'openai';
import { Tool } from '../../tools/tool.js';
import { ChatCompletionToolChoiceOption } from 'openai/resources/index.js';
import { Threads } from '../../../../repositories/postgres/threads.postgres.js';
import { encode } from 'gpt-3-encoder';
import { encodingForModel, getEncoding } from 'js-tiktoken';
import { OpenAIError, OpenAIFunctionError } from '../errors.js';

export abstract class OpenAI extends LLM {
  tool: Tool;
  tools: Tool[];
  conditional_tools: Tool[];
  tool_count: number;
  database: Threads;
  request: OpenAIRequest;
  completion_start: number | null;
  configuration: OpenAIRequestConfiguration;
  prompt_tokens: number;
  completion_tokens: number;
  execution_error: boolean;
  answer: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cache: { [key: string]: any };

  // this is used for streaming only
  callback?: (input: CallbackEvent) => void;
  close?: () => void;

  constructor({ client, tools = [], conditional_tools = [] }) {
    super({ client });

    this.answer = '';
    this.tool = null;
    this.tools = tools;
    this.conditional_tools = conditional_tools;
    this.tool_count = 0;

    this.request = null;
    this.configuration = null;
    this.database = null;

    this.completion_tokens = 0;
    this.prompt_tokens = 0;
    this.completion_start = null;
    this.execution_error = false;
    this.cache = {};
  }

  public async call(
    configuration: OpenAIRequestConfiguration,
    request: OpenAIRequest,
    database: Threads,
    tool_choice: ChatCompletionToolChoiceOption = null,
    model: OpenAIModel | null = null
  ): Promise<OpenAIResponse> {
    console.log('call', configuration, request, database, tool_choice, model);
    throw new Error("Method 'call' must be implemented.");
  }

  /**
   * This function is called at the very beginning of the completion process for setup
   * @param configuration The configuration of the OpenAI chat model
   * @param request The request object containing all information about the request
   * @param database The database object used for storing the request information
   */

  public setupCall(configuration: OpenAIRequestConfiguration, request: OpenAIRequest, database: Threads) {
    // calculate the prompt tokens from messages and defined functions
    this.prompt_tokens = this.chat_completion_prompt_tokens(
      configuration.model,
      configuration.messages,
      this.tool_list
    );

    // store the request information for later use
    this.request = request;
    this.configuration = configuration;
    this.database = database;

    // start the timer for completion duration
    this.completion_start = performance.now();
  }

  private get maxToolCount() {
    if (this.request.chatbot === 'slack') return 10;
    return 6;
  }

  public async runTool() {
    this.tool_count += 1;

    // force a response if max function count is reached
    if (this.tool_count >= this.maxToolCount) {
      return this.error('Max function count reached.', 'function');
    }

    try {
      // Remove extra opening brace if it starts with {{
      if (this.tool.arguments.startsWith('{{')) this.tool.arguments = this.tool.arguments.substring(1);

      // Ensure the string ends with a closing brace }
      if (!this.tool.arguments.trim().endsWith('}')) this.tool.arguments += '}';

      const assistant = {
        role: OpenAIRole.assistant as const,
        content: null,
        function_call: { name: this.tool.name, arguments: this.tool.arguments },
      };

      const tool = this.tools.find((x) => x.name === this.tool.name);

      // const { context, used, system, matches } = await this.function.execute();
      const { system, tool_output, metadata } = await this.tool.execute(this.cache);

      const {
        matched_documents,
        used_documents,
        show_feedback,
        show_help_action,
        result,
        retry,
        model,
        tools,
        tool_choice,
        decision,
      } = metadata;

      if (model) this.request.model = model;
      if (matched_documents.length) this.cache.matched_documents = matched_documents;

      // Add conditonal functions to list of available functions
      if (tool_choice) {
        tools.forEach((tool_name) => {
          const toolExists = this.conditional_tools.some((x) => x.name === tool_name);
          const toolAdded = this.tools.some((x) => x.name === tool_name);

          if (toolExists && !toolAdded) {
            this.tools.push(this.conditional_tools.find((x) => x.name === tool_name));
          }
        });
      }

      if (retry) {
        console.log('\n[FAILURE] Retrying Request', metadata);
        tool.arguments = '{';
        this.tool = null;

        return this.call(this.configuration, this.request, this.database, tool_choice, model);
      }

      this.request.metadata.show_feedback = show_feedback;
      this.request.metadata.show_help_action = show_help_action;

      const isRequestToContactSupport = this.tool_count === 1 && this.tool.name === 'contact_support';
      this.request.metadata.result = isRequestToContactSupport ? 'contact_support' : result;

      // sending the function execution duration
      const total_duration = { name: this.tool.name, duration: (performance.now() - this.completion_start) / 1000 };
      if (this.callback) this.callback({ type: 'timer', value: total_duration });

      const system_message = {
        role: OpenAIRole.system as const,
        content: system,
      };

      if (this.callback) {
        this.callback({ type: 'documents', value: used_documents });
        this.callback({
          type: 'matches',
          value: matched_documents.map((match) => ({
            title: match.title,
            url: match.url,
            type: match.type,
            certainty: match.matched.certainty,
            tokens: match.total_tokens,
          })),
        });
      }

      const documents = [
        ...used_documents.map((x) => this.formatDocument(x.url, 'used')),
        ...matched_documents.map((x) => this.formatDocument(x.url, 'matched')),
      ];

      // function_output in OpenAI format
      const output = {
        role: OpenAIRole.function as const,
        name: this.tool.name,
        content: tool_output,
      };

      // remove the previous system message
      const messagesWithoutSystem = this.configuration.messages.filter((x) => x.role !== (OpenAIRole.system as const));

      let messages = [...this.configuration.messages, assistant, output];
      if (system) messages = [system_message, ...messagesWithoutSystem, assistant, output];
      if (decision && !tool_output) messages = [system_message, ...messagesWithoutSystem, assistant];

      // send the function called to the client
      if (this.callback) {
        this.callback({
          type: 'function',
          value: {
            action: this.tool.name,
            input: this.tool.arguments,
            system,
            output: tool_output,
          },
        });
      }

      // update the system message to be used in the next completion
      this.request.system = system;

      // store the function completion information for later database storage
      this.request.metadata.tool_completions.push({
        id: uuidv4(),
        message_id: this.request.message_id,
        system: system,
        tool_name: this.tool.name,
        tool_arguments: this.tool.arguments,
        tool_output,
        model: this.request.model,
        prompt_tokens: this.prompt_tokens,
        completion_tokens: encode(tool_output)?.length || 0,
        duration: (performance.now() - this.completion_start) / 1000,
      });

      // reset the function arguments incase it is called multiple times
      tool.arguments = '{';

      // reset the function class properties incase it is called multiple times
      this.tool = null;
      this.prompt_tokens = 0;
      this.completion_tokens = 0;
      this.completion_start = performance.now();
      this.request.metadata.documents = [...this.request.metadata.documents, ...documents];

      return this.call({ ...this.configuration, messages }, this.request, this.database, tool_choice, model);
    } catch (e) {
      console.log('Openai.ts Error in OpenAI function call:', e);
      return this.error(e?.message || 'OpenAI.ts Failed to execute function call', 'function');
    }
  }

  public chat_completion_prompt_tokens = (model, messages, functions) => {
    try {
      const message_tokens = this.num_tokens_from_messages(messages, model);
      const function_tokens = this.function_definition_tokens(model, functions);

      return message_tokens + function_tokens;
    } catch (e) {
      console.log('Error calculating prompt tokens:', e?.message || e);
      return 0;
    }
  };

  public function_call_tokens = (model, functionCall) => {
    if (!functionCall) {
      console.error('Error: Function call token calculator executed without functionCall');
      return 0;
    }

    let encoding;
    let sum = 0;

    try {
      encoding = encodingForModel(model);
    } catch (e) {
      console.warn('model not found. Using cl100k_base encoding.');
      encoding = getEncoding('cl100k_base');
    }

    sum += this.get_token_count(encoding, JSON.stringify(functionCall));
    return sum + 12;
  };

  /**
   * Used to handle errors during the completion process
   * @param err The error message
   * @param type The type of error
   */

  public error(err: any, type: 'initiate' | 'streaming' | 'function') {
    let parsed_error = err;
    if (err instanceof APIError) parsed_error = err.message;

    if (this.execution_error) return;

    this.execution_error = true;

    const isInitiate = type === 'initiate';
    const isFunction = type === 'function';

    const message = isInitiate ? 'Failed to initiate stream with Open AI.' : 'Failure during streaming from Open AI.';
    const error = isFunction ? OpenAIFunctionError(message, parsed_error) : OpenAIError(message, parsed_error);

    if (this.callback) {
      // send the error event
      this.callback({ type: 'error', value: error });

      // sending the total duration as a separate event so it can be displayed in the UI
      const total_duration = { name: `Total Duration`, duration: (performance.now() - this.request.start) / 1000 };
      this.callback({ type: 'timer', value: total_duration });
    }

    if (isInitiate) console.log(`Response Error (pre-stream) (${parsed_error})`);
    else console.log(`Response Error (post-stream) (${parsed_error})`);

    this.request.prompt_tokens = this.prompt_tokens;
    this.request.completion_tokens = this.completion_tokens;
    this.request.answer = this.answer;
    this.request.metadata.result = 'error';

    try {
      this.database.store(error);
    } catch (e) {
      console.log('Failed to store error in database', e?.message || 'An unexpected error occured.');
    }

    if (!this.callback) return error;
    else this.close();
  }

  /**
   * A helper function for formatting used and matched documents for database storage
   * @param document_url The url of the document
   * @param type The type of document
   * @returns A database formatted object for the document
   */

  formatDocument = (document_url: string, type: 'used' | 'matched') => {
    return {
      document_id: uuidv4(),
      message_id: this.request.message_id,
      type: type,
      url: document_url,
    };
  };

  /**
   * A helper function for converting the model to a specific version
   * @param model The model to convert
   * @returns The model converted to a specific version
   */

  getModel(model: string) {
    if (model === 'gpt-4-32k' || model === OpenAIModel.gpt4_32k) return OpenAIModel.gpt4_32k;
    if (model === 'gpt-4' || model === OpenAIModel.gpt4) return OpenAIModel.gpt4_latest;
    if (model === 'gpt-3.5-turbo' || model === OpenAIModel.gpt3) return OpenAIModel.gpt3_latest;

    return OpenAIModel.gpt4_latest;
  }

  /**
   * This is a helper function for getting the function definitions
   */

  get tool_list() {
    if (!this.tools || this.tools.length === 0) return undefined;
    return this.tools.map((tool) => tool.define);
  }

  filterUniqueObjects(arr) {
    const seen = new Set();
    return arr.filter((item) => {
      const identifier = `${item.type}-${item.message}`;
      if (seen.has(identifier)) {
        return false;
      } else {
        seen.add(identifier);
        return true;
      }
    });
  }

  /**
   * Functions translated from Java equivalent in tiktoken project
   * These functions are subject to change and should be regularly checked
   * https://github.dev/forestwanglin/openai-java/tree/main
   */

  private function_definition_tokens = (model, functions) => {
    if (!functions) return 0;

    let encoding;
    let sum = 0;

    try {
      encoding = encodingForModel(model);
    } catch (e) {
      console.warn('model not found. Using cl100k_base encoding.');
      encoding = getEncoding('cl100k_base');
    }

    for (const func of functions) {
      sum += this.get_token_count(encoding, func.name);
      sum += this.get_token_count(encoding, func.description);

      if (func?.parameters) {
        if ('properties' in func.parameters) {
          for (const [key, value] of Object.entries(func.parameters.properties)) {
            sum += this.get_token_count(encoding, key);

            for (const [funcKey, funcValue] of Object.entries(value)) {
              if (funcKey === 'type') {
                sum += 2;
                sum += this.get_token_count(encoding, funcValue);
              } else if (funcKey === 'description') {
                sum += 2;
                sum += this.get_token_count(encoding, funcValue);
              } else if (funcKey === 'enum') {
                sum -= 3;

                for (const enumValue of funcValue) {
                  sum += 3;
                  sum += this.get_token_count(encoding, enumValue);
                }
              } else {
                console.error('Unknown function parameter key', { [funcKey]: funcValue });
              }
            }
          }
        }

        sum += 11;
      }
    }

    return sum + 12;
  };

  /**
   * Functions translated from Java equivalent in tiktoken project
   * These functions are subject to change and should be regularly checked
   * https://github.dev/forestwanglin/openai-java/tree/main
   */

  private num_tokens_from_messages = (messages, model) => {
    let encoding;
    let tokens_per_message;
    let tokens_per_name;

    try {
      encoding = encodingForModel(model);
    } catch (e) {
      console.warn('model not found. Using cl100k_base encoding.');
      encoding = getEncoding('cl100k_base');
    }

    if (model.startsWith('gpt-3.5-turbo')) {
      tokens_per_message = 4;
      tokens_per_name = -1;
    }

    if (model.startsWith('gpt-4')) {
      tokens_per_message = 3;
      tokens_per_name = 1;
    }

    if (model.endsWith('-0613') || model === 'gpt-3.5-turbo-16k') {
      tokens_per_message = 3;
      tokens_per_name = 1;
    }

    let sum = 0;

    for (const message of messages) {
      sum += tokens_per_message;
      sum += this.get_token_count(encoding, message.content);
      sum += this.get_token_count(encoding, message.role);

      if (Object.keys(message).includes('name')) {
        sum += this.get_token_count(encoding, message.name);
        sum += tokens_per_name;
      }

      if (Object.keys(message).includes('function_call')) {
        sum += 1;
        sum += this.get_token_count(encoding, message.function_call.name);

        if (Object.keys(message.function_call).includes('arguments')) {
          sum += this.get_token_count(encoding, message.function_call.arguments);
        }
      }
    }

    const total_prompt_tokens = sum + 3;
    // console.log('total_prompt_tokens', total_prompt_tokens);

    if (Number.isInteger(total_prompt_tokens)) return total_prompt_tokens;
    return 0;
  };

  private get_token_count = (encoding, value): number => {
    if (!value) return 0;
    return encoding.encode(value).length;
  };
}
