import { OpenAI } from 'openai';

export abstract class LLM {
  client: OpenAI;

  constructor({ client }) {
    this.client = client;
  }
}
