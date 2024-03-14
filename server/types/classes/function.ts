import { ChatCompletionToolChoiceOption } from 'openai/resources';
import { Match, UsedDocuments } from './context';
import { OpenAIModel } from './openai';

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
