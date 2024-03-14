import { Postgres } from './postgres.js';

export class Pricing extends Postgres {
  constructor() {
    super();
  }

  /**
   * Used to check how much each chat completion, and tool completion cost for a given time period. It also provides a total spent for the time period.
   * @param start_date The start date for the time period
   * @param end_date The end date for the time period
   * @returns The total cost, total chat cost, and total tool cost for the time period
   */

  public getModelCost = async (start_date: string, end_date: string) => {
    const query = `--sql
      SELECT
      m.message_id,
        COALESCE(cc.prompt_tokens, 0) as chat_prompt_tokens,
        COALESCE(cc.completion_tokens, 0) as chat_completion_tokens,
        SUM(COALESCE(tc.prompt_tokens, 0)) as tool_prompt_tokens,
        SUM(COALESCE(tc.completion_tokens, 0)) as tool_completion_tokens,
        COALESCE(cc.prompt_tokens, 0) + SUM(COALESCE(tc.prompt_tokens, 0)) + SUM(COALESCE(tc.prompt_tokens, 0)) as prompt_tokens,
        COALESCE(cc.completion_tokens, 0) + SUM(COALESCE(tc.completion_tokens, 0)) + SUM(COALESCE(tc.completion_tokens, 0)) as completion_tokens,
        COALESCE(cc.prompt_tokens, 0) + SUM(COALESCE(tc.prompt_tokens, 0)) + SUM(COALESCE(tc.prompt_tokens, 0)) + COALESCE(cc.completion_tokens, 0) + SUM(COALESCE(tc.completion_tokens, 0)) + SUM(COALESCE(tc.completion_tokens, 0)) as total_tokens,
      cc.model
      FROM messages as m
      LEFT JOIN chat_completions cc on cc.message_id = m.message_id
      LEFT JOIN tool_completions tc on tc.message_id = m.message_id
      WHERE m.created_at >= $1 AND m.created_at <= $2
      GROUP by m.message_id, cc.prompt_tokens, cc.completion_tokens, cc.model
    `;

    const { data, error } = await this.start_end_query('chatbot', query, start_date, end_date);
    if (error) throw new Error(JSON.stringify(error));

    const total_chat_completion_cost = data
      .map((x) => this.calculateCost(x.model, x.chat_prompt_tokens, x.chat_completion_tokens)?.total_cost)
      .reduce((acc, curr) => acc + curr, 0);

    const total_tool_completion_cost = data
      .map((x) => this.calculateCost(x.model, x.tool_prompt_tokens, x.tool_completion_tokens)?.total_cost)
      .reduce((acc, curr) => acc + curr, 0);

    const total_cost = (total_chat_completion_cost + total_tool_completion_cost).toFixed(2);
    const total_tool_cost = total_tool_completion_cost.toFixed(2);
    const total_chat_cost = total_chat_completion_cost.toFixed(2);

    return { total_cost, total_chat_cost, total_tool_cost };
  };

  /**
   * Used for determining the price for prompt tokens and completion tokens for a given model.
   * @param model The model to check
   * @returns The cost of prompt tokens and completion tokens per 1000 tokens
   */

  public getModelPricing = (model: string) => {
    if (!model) return { cost_per_prompt_token: 0.02 / 1000, cost_per_completion_token: 0.02 / 1000 };

    /*
      Pricing may change and will need to be adjusted here accordingly
      https://openai.com/pricing
    */

    if (model === 'gpt-4-1106-preview' || model === 'gpt-4-turbo-preview')
      return {
        cost_per_prompt_token: 0.01 / 1000,
        cost_per_completion_token: 0.03 / 1000,
        model: 'gpt-4-turbo-preview',
      };

    if (model === 'gpt-4-32k')
      return { cost_per_prompt_token: 0.06 / 1000, cost_per_completion_token: 0.12 / 1000, model: 'gpt-4-32k' };

    if (model.includes('gpt-4'))
      return { cost_per_prompt_token: 0.03 / 1000, cost_per_completion_token: 0.06 / 1000, model: 'gpt-4' };

    if (model === 'gpt-3.5-turbo-1106')
      return {
        cost_per_prompt_token: 0.001 / 1000,
        cost_per_completion_token: 0.002 / 1000,
        model: 'gpt-3.5-turbo-1106',
      };

    if (model === 'gpt-3.5-turbo-instruct')
      return {
        cost_per_prompt_token: 0.0015 / 1000,
        cost_per_completion_token: 0.002 / 1000,
        model: 'gpt-3.5-turbo-instruct',
      };

    if (model.includes('gpt-3.5'))
      return { cost_per_prompt_token: 0.003 / 1000, cost_per_completion_token: 0.006 / 1000, model: 'gpt-3.5' };

    if (model === 'text-davinci-003')
      return { cost_per_prompt_token: 0.02 / 1000, cost_per_completion_token: 0.02 / 1000, model: 'text-davinci-003' };

    throw new Error(`Model not found (${model})`);
  };

  /**
   * Used to calculate the cost for a given model, prompt tokens, and completion tokens.
   * @param model The model to calculate cost for
   * @param prompt_tokens_string The number of prompt tokens as a string
   * @param completion_tokens_string The number of completion tokens as a string
   * @returns The prompt cost, completion cost, and total cost
   */

  public calculateCost = (model, prompt_tokens_string, completion_tokens_string) => {
    const prompt_tokens = Number(prompt_tokens_string);
    const completion_tokens = Number(completion_tokens_string);

    // Calculate cost per token
    const { cost_per_prompt_token, cost_per_completion_token } = this.getModelPricing(model);

    // Calculate cost for each token type
    const prompt_cost = prompt_tokens * cost_per_prompt_token;
    const completion_cost = completion_tokens * cost_per_completion_token;

    // Total cost is sum of both costs
    const total_cost = prompt_cost + completion_cost;

    return {
      prompt_cost: Number(prompt_cost),
      completion_cost: Number(completion_cost),
      total_cost: Number(total_cost),
    };
  };
}
