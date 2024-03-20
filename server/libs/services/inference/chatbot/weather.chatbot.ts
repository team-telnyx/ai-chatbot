import { Chatbot, Configuration } from './chatbot.js';
import { Threads } from '../../../repositories/postgres/threads.postgres.js';

import { ChatCompletionMessageParam } from 'openai/resources/index.js';
import { ChatbotQuestion, OpenAIRequest, OpenAIRequestConfiguration } from '../types.js';

export class WeatherChatbot extends Chatbot {
  system: string | null;

  constructor({ req, res, tools, conditional_tools = [], chatbot = null, system = null, required = null }) {
    super({ req, res, tools, conditional_tools, chatbot, required });
    this.system = system;
  }

  public async configure(params: ChatbotQuestion): Promise<Configuration> {
    const session_id = params?.session_id || null;
    const question = params.question;

    const database: Threads = new Threads();
    const history = await database.history(session_id);
    const messages: ChatCompletionMessageParam[] = this.formatMessages(question, this.system, history);

    if (!this.system) throw new Error('No system message defined');

    const config: OpenAIRequestConfiguration = {
      ...this.baseOpenAIConfig,
      chatbot: this.chatbot,
      session_id: params.session_id,
      message_id: params.message_id,
      user_id: params.user_id,
      system: this.system,
      question,
      messages,
    };

    const request: OpenAIRequest = this.formatRequest(config);
    database.request = request;

    return { configuration: config, request, database };
  }
}
