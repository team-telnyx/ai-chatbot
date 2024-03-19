import Pool from 'pg-pool';

import { v4 as uuidv4 } from 'uuid';
import { Postgres } from './postgres.js';
import { Pricing } from './pricing.postgres.js';
import { DatabaseMessage, OpenAIRequest } from '../../services/inference/types.js';
import { ErrorType } from '../../services/types.js';

export class Threads extends Postgres {
  request: OpenAIRequest | null;
  pricing: Pricing;

  constructor(request = null) {
    super();
    this.request = request;
    this.pricing = new Pricing();
  }

  /**
   * Store a chatbot request to the database
   * @param error If an error occured during the execution, it is passed to this function to add the error details to the database.
   */

  public async store(error?: ErrorType | null): Promise<void> {
    console.log('Storing request', this.request);

    try {
      await this.transaction(async (client) => {
        await this.store_conversation(client);
        await this.store_messages(client, error);
        await this.store_tools(client);
        await this.store_answer(client, Boolean(error));
        await this.store_documents(client);
      });
    } catch (e) {
      console.log('pgThreads.ts - Failed to store request to the database.');
      console.log(e?.message || 'An unexpected error occured with the database.');
    }
  }

  /**
   * Helper function for retrieving the chat history from the database
   * @param session_id The session id to retrieve the chat history for
   * @param limit The limit of messages to retrieve
   * @returns A list of messages from the database
   */

  public async history(session_id: string | null, limit = 5): Promise<DatabaseMessage[]> {
    if (!session_id) return [];

    const chat_history_query = `--sql
      SELECT m.user_message, cc.answer as bot_message
      FROM messages as m
      LEFT JOIN chat_completions as cc ON cc.message_id = m.message_id
      WHERE m.session_id = $1 AND m.user_message != '' AND cc.answer != '' AND cc.type != 'internal_request'
      ORDER BY m.created_at DESC
      LIMIT $2;
    `;

    const { data, error } = await this.query('chatbot', chat_history_query, [session_id, limit]);

    if (!data) return [];
    if (error) throw new Error(JSON.stringify(error));

    const history = [];

    for (const message of data.reverse()) {
      history.push({
        type: 'user',
        message: message.user_message,
      });

      history.push({
        type: 'bot',
        message: message.bot_message,
      });
    }

    if (history.length) console.log('history', history);
    return history || [];
  }

  /**
   * Database: ai_chatbot
   * Table: conversations
   */

  private async store_conversation(client: Pool) {
    if (!this.request.session_id) return;

    const { session_id, user_id } = this.request;
    const { error } = await this.insertIgnoreConflict(client, 'conversations', { session_id, user_id });

    if (error) throw new Error(`Error storing conversation: ${JSON.stringify(error)}`);
  }

  /**
   * Database: ai_chatbot
   * Table: messages
   */

  private async store_messages(client: Pool, executionError: ErrorType | null) {
    const { chatbot, type, query, session_id, message_id, user_id, metadata } = this.request;
    const { show_help_action, show_feedback, processing_duration } = metadata;

    const model = this.request.model;
    const chat_prompt_tokens = this.request.prompt_tokens;
    const chat_completion_tokens = this.request.completion_tokens;

    const { prompt_cost, completion_cost } = this.pricing.calculateCost(
      model,
      chat_prompt_tokens,
      chat_completion_tokens
    );

    const { error } = await this.insert(client, 'messages', {
      message_id,
      session_id,
      user_id,
      user_message: query,
      processing_duration,
      show_help_action,
      show_feedback,
      error_title: executionError?.meta?.title,
      error_detail: executionError?.meta?.detail,
      error_message: executionError?.meta?.message,
      request_type: type,
      chatbot: chatbot,
      prompt_cost: prompt_cost,
      completion_cost: completion_cost,
    });

    if (error) throw new Error(`Error storing conversation messages: ${JSON.stringify(error)}`);
  }

  /**
   * Database: ai_chatbot
   * Table: tool_completions
   */

  private async store_tools(client: Pool) {
    const { metadata } = this.request;
    const { tool_completions } = metadata;

    for (const completion of tool_completions) {
      const model = completion.model;
      const prompt_tokens = completion.prompt_tokens;
      const completion_tokens = completion.completion_tokens;

      const { prompt_cost, completion_cost } = this.pricing.calculateCost(model, prompt_tokens, completion_tokens);

      const completion_with_cost = {
        ...completion,
        prompt_cost,
        completion_cost,
      };

      const { error } = await this.insert(client, 'tool_completions', completion_with_cost);
      if (error) throw new Error(`Error storing conversation functions: ${JSON.stringify(error)}`);
    }
  }

  /**
   * Database: ai_chatbot
   * Table: chat_completions
   */

  private async store_answer(client: Pool, hasError = false) {
    const { metadata } = this.request;
    const { result } = metadata;

    const duration = (performance.now() - this.request.start) / 1000;

    const { error } = await this.insert(client, 'chat_completions', {
      id: uuidv4(),
      message_id: this.request.message_id,
      type: hasError ? 'error' : result,
      system: this.request.system,
      context: null,
      answer: this.request.answer,
      model: this.request.model,
      prompt_tokens: this.request.prompt_tokens,
      completion_tokens: this.request.completion_tokens,
      duration,
    });

    if (error) throw new Error(`Error storing conversation answer: ${JSON.stringify(error)}`);
  }

  /**
   * Database: ai_chatbot
   * Table: documents
   */

  private async store_documents(client: Pool) {
    const { metadata } = this.request;
    const { documents } = metadata;

    // removing duplicates
    const filtered_documents = documents.filter(
      (v, i, a) => a.findIndex((v2) => v2.url === v.url && v.type === v.type) === i
    );

    for (const document of filtered_documents) {
      const { error } = await this.insert(client, 'documents', document);
      if (error) throw new Error(`Error storing conversation documents: ${JSON.stringify(error)}`);
    }
  }
}
