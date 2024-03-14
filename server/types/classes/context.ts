import { TelnyxBucketChunk, TelnyxLoaderType } from '../../libs/services/documents/vectorstore/telnyx.js';
import { Error } from '../common.js';
import { DocumentType } from './loader.js';
import { TelnyxSimilaritySearchLoaderMetadata } from './vectorstore.js';

export type Match = {
  identifier: string;
  type: DocumentType;
  url: string;
  title: string;
  description: string;
  paragraphs: TelnyxBucketChunk[];
  total_tokens: number;
  override?: string;
  loader_type: TelnyxLoaderType;
  matched: {
    heading: string;
    content: string;
    bucket?: string;
    index?: string;
    certainty: number;
  };
  bucket_name?: string;
  document?: any;
  metadata?: {
    describe?: string;
  };
};

export type RawMatch = {
  identifier: string;
  url: string;
  paragraph: {
    heading: string;
    content: string;
  };
  bucket_name?: string;
  loader_type: TelnyxLoaderType;
  loader_metadata?: TelnyxSimilaritySearchLoaderMetadata;
  certainty: number;
  type: string;
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
