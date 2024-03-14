/* eslint-disable @typescript-eslint/no-explicit-any */
import { Request } from 'express';
import { OpenAIExecuteTool } from '../../../../types/classes/function.js';
import { ChatCompletionToolChoiceOption } from 'openai/resources/index.js';
import { Telnyx } from '../../documents/vectorstore/telnyx.js';
import { TelnyxContext } from '../../documents/context/telnyx.js';
import { Context } from '../../documents/context/context.js';

export abstract class Tool {
  req: Request;
  name: string;
  description: string;
  chatbot: string;
  context: Context;
  arguments: string;
  not_found: string;

  constructor({ req, chatbot = 'default' }) {
    const vectorstore = new Telnyx();

    this.req = req;
    this.chatbot = chatbot;
    this.context = new TelnyxContext({ vectorstore });
    this.arguments = '{';
    this.not_found = 'There was no documentation found to support this question.';
  }

  public abstract execute(cache: { [field: string]: any }): Promise<OpenAIExecuteTool>;
  public abstract get define(): any;

  public response({ system, tool_output, metadata }: OpenAIExecuteTool): OpenAIExecuteTool {
    return {
      system,
      tool_output: tool_output || 'N/A',
      metadata: {
        result: metadata?.result || 'cant_answer',
        used_documents: metadata?.used_documents || [],
        matched_documents: metadata?.matched_documents || [],
        show_help_action: metadata?.show_help_action || false,
        show_feedback: metadata?.show_feedback || false,
        tools: metadata?.tools || [],
        tool_choice: metadata?.tool_choice || 'auto',
        model: metadata?.model || null,
        retry: metadata?.retry || false,
      },
    };
  }

  public error(e, retry = false, tool_choice: ChatCompletionToolChoiceOption = null) {
    const func = JSON.stringify({ name: this.name, arguments: this.arguments });
    const err = e?.message || 'An unexpected error occured.';
    const errorMessage = `Tool.ts Failed to execute function: ${func} for reason: ${err}`;

    if (retry) {
      console.log(errorMessage);
      return this.response({
        system: 'An error occured.',
        tool_output: 'error',
        metadata: {
          tool_choice,
          tools: tool_choice ? ['api_details', 'api_full'] : [],
          retry,
        },
      });
    }

    throw new Error(errorMessage);
  }

  public parseArguments(args: string) {
    try {
      return JSON.parse(args);
    } catch (e) {
      console.log(`Error: Function arguments are not valid JSON (${args})`);
      return null;
    }
  }

  public isValidIdentifier(id: string | null | undefined): boolean {
    if (!id) return false;
    if (id.toString().length !== 36) return false;

    const part1 = id.substring(0, 8);
    if (!this.isValid(part1)) return false;

    const part2 = id.substring(9, 13);
    if (!this.isValid(part2)) return false;

    const part3 = id.substring(14, 18);
    if (!this.isValid(part3)) return false;

    const part4 = id.substring(19, 23);
    if (!this.isValid(part4)) return false;

    const part5 = id.substring(24, 36);
    if (!this.isValid(part5)) return false;

    if (id.substring(8, 9) !== '-') return false;
    if (id.substring(13, 14) !== '-') return false;
    if (id.substring(18, 19) !== '-') return false;
    if (id.substring(23, 24) !== '-') return false;

    return true;
  }

  private isValid(num: string) {
    return !num?.includes('-');
  }
}
