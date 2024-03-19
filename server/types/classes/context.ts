import { TelnyxBucketChunk, TelnyxLoaderType } from '../../libs/services/documents/vectorstore/telnyx.js';
import { Error } from '../common.js';
import { DocumentType } from './loader.js';
import { TelnyxSimilaritySearchLoaderMetadata } from './vectorstore.js';

export type RawMatch = {
  identifier: string;
  url?: string;
  chunk: TelnyxSimilarityResult;
  loader_type: TelnyxLoaderType;
  loader_metadata?: TelnyxSimilaritySearchLoaderMetadata;
  type: string;
};

export type Match = {
  identifier: string;
  type: DocumentType;
  url: string;
  title: string;
  description: string;
  total_tokens: number;
  override?: string;
  paragraphs: TelnyxBucketChunk[];
  loader_type: TelnyxLoaderType;
  matched: TelnyxSimilarityResult;
};

type TelnyxSimilarityResult = {
  heading: string | null;
  content: string;
  bucket: string;
  certainty: number;
  tokens: number;
};

export type UsedDocuments = {
  title: string;
  url: string;
  tokens: string | number;
};

export type PromptType = {
  document?: any;
  context?: string;
  error?: Error | null;
  used?: UsedDocuments[];
};

export type MatchResponse = {
  matches: Match[];
  error: Error | null;
};

export type FormattedPrompt = {
  context: string;
  used: UsedDocuments[];
};

export type Indexes = {
  index: string;
  weight: number;
};
