import { ChatCompletionMessageParam, ChatCompletionToolChoiceOption } from 'openai/resources';
import { Match, UsedDocuments } from '../documents/types';
import { ErrorType } from '../types';

export type OpenAIRequestConfiguration = {
  chatbot: string;
  session_id?: string | null;
  message_id: string;
  user_id: string;
  system: string;
  question: string;
  messages: ChatCompletionMessageParam[];
  max_tokens: number;
  model: OpenAIModel;
  response_format?: { type: 'json_object' | 'text' };
  temperature?: number;
  save_thread?: boolean;
};

export enum OpenAIModel {
  gpt4_32k = 'gpt-4-32k',
  gpt4 = 'gpt-4',
  gpt3 = 'gpt-3.5-turbo',
  gpt3_latest = 'gpt-3.5-turbo-1106',
  gpt4_latest = 'gpt-4-turbo-preview',
}

export enum OpenAIRole {
  system = 'system',
  assistant = 'assistant',
  user = 'user',
  function = 'function',
  tool = 'tool',
}

export type OpenAIUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type OpenAIResponse = OpenAIHttpResponse | ErrorType | OpenAIRequest | void;

export type OpenAIHttpResponse = {
  id: string;
  answer: string;
  usage: OpenAIUsage;
  finish_reason: string;
};

export type OpenAIStreamResponse = {
  id: string;
  answer: string;
  usage: OpenAIUsage;
  finish_reason: string;
};

export type OpenAIRequest = {
  chatbot: string;
  type?: 'stream' | 'http' | null;
  user_id: string;
  message_id: string;
  session_id: string;
  query: string;
  answer: string | null;
  system: string;
  model: OpenAIModel;
  start: number;
  prompt_tokens: number;
  completion_tokens: number;
  metadata: OpenAIMetadata | null;
  response_format: { type: 'json_object' | 'text' };
  save_thread?: boolean;
} | null;

export type OpenAIMetadata = {
  tool_completions: ToolCompletion[];
  documents: Document[];
  processing_duration?: number;
  show_help_action?: boolean;
  show_feedback?: boolean;
  error?: ErrorType | null;
  result: string;
};

type ToolCompletion = {
  id: string;
  message_id: string;
  system: string;
  tool_name: string;
  tool_arguments: string;
  tool_output: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  duration: number;
};

type Document = {
  url: string;
  message_id: string;
  type: string;
};

export type DatabaseMessage = {
  type: 'user' | 'bot';
  message: string;
};

type OpenAIChoices = {
  index: number;
  delta: OpenAIDelta;
  finish_reason?: string;
};

type OpenAIDelta = {
  function_call?: {
    arguments: string;
  };
};

export type OpenAIFunctionStream = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChoices;
};

export type ChatbotQuestion = {
  user_id: string;
  session_id?: string | null;
  message_id: string;
  question: string;
};

export type OpenAIExecuteTool = {
  system: string;
  tool_output: string;
  metadata: OpenAIExecuteFunctionMetadata;
};

export type OpenAIExecuteFunctionMetadata = {
  used_documents?: UsedDocuments[];
  matched_documents?: Match[];
  show_help_action?: boolean;
  show_feedback?: boolean;
  result?: string;
  tools?: string[];
  tool_choice?: ChatCompletionToolChoiceOption;
  model?: OpenAIModel | null;
  output_format?: string;
  retry?: boolean;
  decision?: boolean;
};
