import { Request, Response } from 'express';
import { OpenAIStream } from '../llm/openai/stream.js';
import { OpenAIHTTP } from '../llm/openai/http.js';
import { Tool } from '../tools/tool.js';
import { Threads } from '../../../repositories/postgres/threads.postgres.js';
import { MissingBodyParameters, MissingParameters, Unexpected } from './errors.js';
import { ChatCompletionMessage } from 'openai/resources/index.js';
import { v4 as uuidv4 } from 'uuid';
import {
  ChatbotQuestion,
  DatabaseMessage,
  OpenAIMetadata,
  OpenAIModel,
  OpenAIRequest,
  OpenAIRequestConfiguration,
  OpenAIRole,
} from '../types.js';
import { CallbackEvent } from '../../types.js';

export type Configuration = {
  configuration: OpenAIRequestConfiguration;
  request: OpenAIRequest;
  database: Threads;
};

export abstract class Chatbot {
  req: Request;
  res: Response | null;
  chatbot: null | string;
  tools?: Tool[];
  conditional_tools?: Tool[];
  required_body: string[];
  required_query: string[];
  baseOpenAIConfig: {
    max_tokens: number;
    model: OpenAIModel;
    response_format: { type: 'json_object' | 'text' };
    temperature: number;
  };
  callback?: (input: CallbackEvent) => void;

  constructor({ req, res, tools, conditional_tools, chatbot = null, required = null }) {
    this.req = req;
    this.res = res;

    this.tools = tools || [];
    this.conditional_tools = conditional_tools || [];
    this.chatbot = chatbot;

    this.required_body = required?.body || [];
    this.required_query = required?.query || [];

    this.baseOpenAIConfig = {
      max_tokens: 1000,
      model: OpenAIModel.gpt4_latest,
      response_format: { type: 'text' },
      temperature: 0,
    };
  }

  public async ask(params: ChatbotQuestion) {
    if (!this.res) return await this.http(params);
    await this.stream(params);
  }

  public async configure(params: ChatbotQuestion): Promise<Configuration> {
    console.log('configure', params);
    throw new Error("Method 'configure' must be implemented.");
  }

  private async http(params: ChatbotQuestion) {
    const llm = new OpenAIHTTP({
      client: this.req.app.locals.openai,
      tools: this.tools,
      conditional_tools: this.conditional_tools,
    });

    // ensure that all required query parameters are present
    if (!this.required_query.every((key) => Object.keys(this.req.query).includes(key))) {
      const error = MissingParameters(this.required_query, Object.keys(this.req.query));
      return { error };
    }

    // ensure that all required body parameters are present
    if (!this.required_body.every((key) => Object.keys(this.req.body).includes(key))) {
      const error = MissingBodyParameters(this.required_body, Object.keys(this.req.body));
      return { error };
    }

    try {
      const { configuration, request, database } = await this.configure(params);
      return await llm.call(configuration, request, database);
    } catch (e) {
      console.log(e);
      const error = Unexpected('HTTP Request Failed', e?.message);
      return { error };
    }
  }

  private async stream(params: ChatbotQuestion) {
    this.res.setHeader('Content-Type', 'text/event-stream');

    const llm = new OpenAIStream({
      client: this.req.app.locals.openai,
      res: this.res,
      tools: this.tools,
      conditional_tools: this.conditional_tools,
    });

    // ensure that all required query parameters are present
    if (!this.required_query.every((key) => Object.keys(this.req.query).includes(key))) {
      const error = MissingParameters(this.required_query, Object.keys(this.req.query));
      llm.callback({ type: 'error', value: error });
      return this.res.end();
    }

    // ensure that all required body parameters are present
    if (!this.required_body.every((key) => Object.keys(this.req.body).includes(key))) {
      const error = MissingBodyParameters(this.required_body, Object.keys(this.req.body));
      llm.callback({ type: 'error', value: error });
      return this.res.end();
    }

    try {
      const { configuration, request, database } = await this.configure(params);
      await llm.call(configuration, request, database);
    } catch (e) {
      const error = Unexpected('Stream Request Failed', e?.message);
      llm.callback({ type: 'error', value: error });
      return this.res.end();
    }
  }

  /**
   * Formats the request for the Open AI chat completion
   * @param config The starting configuration for the request
   * @returns A request object that can be used to track the request lifecycle and state updates
   */

  public formatRequest(config: OpenAIRequestConfiguration): OpenAIRequest {
    const user_id = config.user_id;
    const question = config.question;
    const session_id = config.session_id || null;
    const message_id = config.message_id || uuidv4();

    const system = config.system;
    const chatbot = config.chatbot;
    const response_format = config.response_format || { type: 'text' };
    const save_thread = config.save_thread ?? true;
    const model = config.model || OpenAIModel.gpt4_latest;

    const metadata: OpenAIMetadata = {
      tool_completions: [],
      documents: [],
      processing_duration: 0,
      show_help_action: false,
      show_feedback: false,
      error: null,
      result: 'initial_request',
    };

    return {
      chatbot,
      type: null,
      user_id,
      message_id,
      session_id,
      query: question,
      answer: null,
      system,
      model,
      start: performance.now(),
      prompt_tokens: 0,
      completion_tokens: 0,
      metadata,
      response_format,
      save_thread: save_thread,
    };
  }

  /**
   * Formats the message array for the Open AI chat model
   * @param options The options and messages to format
   * @returns A list of messages formatted for Open AI chat model consumption
   */

  public formatMessages(query: string, system: string, history: DatabaseMessage[]): ChatCompletionMessage[] {
    const messages = [
      { role: OpenAIRole.system as const, content: system },
      ...history.map((item) => ({
        role: item.type === 'user' ? (OpenAIRole.user as const) : (OpenAIRole.assistant as const),
        content: item.message,
      })),
    ];

    // add the users query as the last message in the array
    messages.push({ role: OpenAIRole.user as const, content: query });

    return messages as ChatCompletionMessage[];
  }
}
