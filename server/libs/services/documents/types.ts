export enum DocumentType {
  telnyx = 'Telnyx_docs',
}

export enum TelnyxLoaderType {
  UnstructuredText = 'text',
  Markdown = 'markdown',
  Intercom = 'intercom',
  PDF = 'pdf',
  JSON = 'json',
  CSV = 'csv',
}

type TelnyxLoaderIntercomMetadata = {
  article_id: string;
  title: string;
  url: string;
  updated_at: string;
  heading: string;
};

export type TelnyxLoaderMetadata = TelnyxLoaderIntercomMetadata | null;

export type TelnyxBucketChunk = {
  heading: string | null;
  content: string;
  tokens: number;
};

export type TelnyxSimilaritySearch = {
  data: {
    data: TelnyxSimilaritySearchResponse[];
  };
};

export type TelnyxSimilaritySearchResponse = {
  document_chunk: string;
  distance: number;
  metadata: TelnyxSimilaritySearchMetadata;
};

type TelnyxSimilaritySearchMetadata = {
  source: string;
  checksum: string;
  embedding: string;
  filename: string;
  certainty: number;
  loader_metadata?: TelnyxSimilaritySearchLoaderMetadata;
};

export type TelnyxSimilaritySearchLoaderMetadata = {
  article_id: string;
  title: string;
  url: string;
  updated_at: string;
  heading: string;
};

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
  chunks: TelnyxBucketChunk[];
  loader_type: TelnyxLoaderType;
  matched: RawMatch;
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

export type TelnyxContextResult = {
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

export type MarkdownDocument = {
  id: string;
  url: string;
  path: string;
  filename: string;
  title: string;
  description: string;
  keywords: string;
  body: string;
  type: string;
};

export type Section = {
  content: string;
  heading?: string;
  slug?: string;
};

export type IntercomResource = {
  id: string;
  type: string;
  workspace_id: string;
  parent_id: number;
  parent_type: string;
  title: string;
  description: string;
  body: string;
  author_id: number;
  state: string;
  created_at: number;
  updated_at: number;
  url: string;
};

export interface IntercomDocument extends IntercomResource {
  metadata: {
    collection: string;
  };
}
