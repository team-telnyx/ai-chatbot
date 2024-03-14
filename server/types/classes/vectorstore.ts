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
