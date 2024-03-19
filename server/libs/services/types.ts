import { Application } from 'express';

export type ErrorType = {
  code: string;
  title: string;
  detail: string;
  meta: {
    code: number;
    title: string;
    detail: string;
    message?: string;
  };
};

export type Message = {
  type: 'user' | 'bot';
  message: string;
};

export type Agent = {
  action: string;
  input: string;
  prompt?: string;
  completion?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  duration?: number;
};

export type Answerable = {
  answerable: boolean;
  prompt?: string;
  completion?: string;
  prompt_tokens?: number;
  completion_tokens?: number;
  duration?: number;
  error?: string;
};

export type OptionData = {
  app: Application;
  question: string;
  message_id: string;
  history: { type: string; message: string }[];
  callback: (event: CallbackEvent) => void;
};

export type Document = {
  title: string;
  url: string;
};

export type Timer = {
  name: string;
  duration: number;
};

export type Classification = {
  action: string;
  input: string;
};

export type CallbackEvent = {
  type: 'token' | 'error' | 'complete' | 'documents' | 'matches' | 'classifier' | 'timer' | 'function';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: string | null | ErrorType | Classification | Document[] | Timer | any;
};
