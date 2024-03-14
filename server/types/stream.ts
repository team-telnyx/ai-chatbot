import { Datastore } from './agents';

export type StoreProps = {
  system: string | null;
  context: string | null;
  user_message: string;
  answer: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  duration: number;
  datastore: Datastore;
};
