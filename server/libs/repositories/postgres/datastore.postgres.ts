import { Postgres } from './postgres.js';
import { v4 as uuidv4 } from 'uuid';

export class Datastore extends Postgres {
  constructor() {
    super();
  }

  /**
   * Used to get a list of conversations with related messages
   * @param start_date The start date to get conversations after
   * @param end_date The end date to get conversations before
   * @returns A list of conversations between the start_date and end_date
   */

  public getConversations = async (start_date: string, end_date: string) => {
    const query = `--sql
      SELECT 
        c.session_id, 
        c.user_id, 
        c.created_at, 
        array_agg(m.message_id) as message_ids
      FROM conversations as c
      LEFT JOIN messages m on c.session_id = m.session_id
      WHERE c.created_at >= $1 AND c.created_at <= $2
      GROUP BY c.session_id, c.user_id, c.created_at
      ORDER BY c.created_at DESC
    `;

    const { data, error } = await this.start_end_query('chatbot', query, start_date, end_date);
    if (error) throw new Error(JSON.stringify(error));

    return data;
  };

  /**
   * Used to get a list of messages
   * @param start_date The start_date to get messages after
   * @param end_date The end_date to get messages before
   * @returns A list of messages between the start_date and end_date
   */

  public getMessages = async (start_date: string, end_date: string) => {
    const query = this.getMessageQuery('time_range');

    const { data, error } = await this.start_end_query('chatbot', query, start_date, end_date);
    if (error) throw new Error(JSON.stringify(error));

    return data;
  };

  /**
   * Used to get the content of a message using the message_id
   * @param message_id The message_id to get content for
   * @returns The content of the message
   */

  public getMessage = async (message_id: string) => {
    const query = this.getMessageQuery();

    const { data, error } = await this.query('chatbot', query, [message_id]);
    if (error) throw new Error(JSON.stringify(error));

    const message = data?.[0];

    if (!message) throw new Error(`No message found for the provided message_id (${message_id}).`);

    return message;
  };

  /**
   * Used to get the metadata for a message
   * @param message_id The message_id to get metadata for
   * @returns The metadata for the messages, including tool_completions and documents used
   */

  public getMetadata = async (message_id: string) => {
    const tools_query = `SELECT * FROM tool_completions WHERE message_id = $1 ORDER BY created_at`;
    const documents_query = `SELECT * FROM documents WHERE message_id = $1`;

    const { data: tools, error: toolsError } = await this.query('chatbot', tools_query, [message_id]);
    if (toolsError) throw new Error(JSON.stringify(toolsError));

    const { data: documents, error: documentsError } = await this.query('chatbot', documents_query, [message_id]);
    if (documentsError) throw new Error(JSON.stringify(documentsError));

    return { tool_completions: tools, documents };
  };

  /**
   * Used to get a list of messages with feedback
   * @param start_date The start_date to get messages from
   * @param end_date The end_date to stop getting messages from
   * @param type The type of feedback to get messages for
   * @returns A list of messages with feedback of specified type between the start_date and end_date
   */

  public getFeedback = async (start_date: string, end_date: string, type: string) => {
    if (type !== 'negative' && type !== 'positive')
      throw new Error(`Please provide a valid (positive/negative) type as a query param.`);

    const query = this.getMessageQuery('feedback');

    const { data, error } = await this.start_end_query('chatbot', query, start_date, end_date, [type]);
    if (error) throw new Error(JSON.stringify(error));

    return data;
  };

  /**
   * Used to set feedback for a message. Cannot be used after feedback is already set.
   * @param message_id The message_id to add feedback for
   * @param user_id The user_id adding feedback
   * @param type The type of feedback
   */

  public setFeedback = async (message_id: string, user_id: string, type: 'positive' | 'negative') => {
    if (!message_id) throw new Error(`Please provide a valid message_id as a body param.`);
    if (!user_id) throw new Error(`Please provide a valid user_id as a body param.`);
    if (type !== 'negative' && type !== 'positive')
      throw new Error(`Please provide a valid (positive/negative) type as a query param.`);

    const insertData = {
      id: uuidv4(),
      message_id,
      user_id,
      type,
    };

    const { success, error } = await this.insert('chatbot', 'feedback', insertData);
    if (error) throw new Error(JSON.stringify(error));
    if (!success) throw new Error('An unexpected error occured. Please try again.');
  };

  private getMessageQuery = (type: string | null = null) => {
    let condition = 'WHERE m.message_id = $1';

    if (type === 'time_range') condition = 'WHERE m.created_at >= $1 AND m.created_at <= $2';
    if (type === 'feedback') condition = 'WHERE m.created_at >= $1 AND m.created_at <= $2 AND fb.type = $3';

    return [
      `--sql
      SELECT
        m.session_id,
        m.message_id,
        m.created_at,
        m.user_message,
        cc.answer as bot_message,
        COALESCE(cc.prompt_tokens, 0) as chat_prompt_tokens,
        COALESCE(cc.completion_tokens, 0) as chat_completion_tokens,
        SUM(COALESCE(tc.prompt_tokens, 0)) as tool_prompt_tokens,
        SUM(COALESCE(tc.completion_tokens, 0)) as tool_completion_tokens,
        COALESCE(cc.prompt_tokens, 0) + SUM(COALESCE(tc.prompt_tokens, 0)) as prompt_tokens,
        COALESCE(cc.completion_tokens, 0) + SUM(COALESCE(tc.completion_tokens, 0)) as completion_tokens,
        COALESCE(cc.prompt_tokens, 0) + SUM(COALESCE(tc.prompt_tokens, 0)) + COALESCE(cc.completion_tokens, 0) + SUM(COALESCE(tc.completion_tokens, 0)) as total_tokens,
        m.user_id,
        m.chatbot,
        cc.model,
        cc.type as result,
        ROUND(CAST(SUM(COALESCE(tc.duration, 0)) AS NUMERIC), 2) as processing_duration,
        ROUND(CAST(cc.duration AS NUMERIC), 2) as completion_duration,
        ROUND(CAST(SUM(COALESCE(tc.duration, 0)) AS NUMERIC) + CAST(COALESCE(cc.duration, 0) AS NUMERIC), 2) as total_duration,
        m.error_title,
        m.error_detail,
        m.error_message,
        m.completion_cost,
        m.prompt_cost,
        fb.type as feedback,
        fb.created_at as feedback_created_at,
        COALESCE(m.prompt_cost, 0) + SUM(COALESCE(tc.prompt_cost, 0)) as total_prompt_cost,
        COALESCE(m.completion_cost, 0) + SUM(COALESCE(tc.completion_cost, 0)) as total_completion_cost,
        (COALESCE(m.prompt_cost, 0) + SUM(COALESCE(tc.prompt_cost, 0))) + (COALESCE(m.completion_cost, 0) + SUM(COALESCE(tc.completion_cost, 0))) as total_cost
      FROM messages as m
      LEFT JOIN chat_completions cc on cc.message_id = m.message_id
      LEFT JOIN tool_completions tc on tc.message_id = m.message_id
      LEFT JOIN feedback fb ON fb.message_id = m.message_id`,
      condition,
      `GROUP by m.message_id, cc.prompt_tokens, cc.completion_tokens, cc.model, cc.answer, cc.duration, fb.type, fb.created_at, m.created_at, cc.type`,
      `ORDER BY m.created_at DESC`,
    ].join('\n');
  };
}
