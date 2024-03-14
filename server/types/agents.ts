import { Error } from './common';

export type ChatCompletion = {
  id: string;
  message_id: string;
  type: string;
  system: string | null;
  context: string | null;
  answer: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  duration: number;
};

export type ToolCompletion = {
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

export type Document = {
  url: string;
  message_id: string;
  type: string;
};

export type Datastore = {
  tool_completions: ToolCompletion[];
  documents: Document[];
  user_id?: string;
  message_id?: string;
  session_id?: string;
  processing_duration?: number;
  show_help_action?: boolean;
  show_feedback?: boolean;
  error?: Error | null;
  classification?: string | null;
  classification_search?: string | null;
  result: string;
};
