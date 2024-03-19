/* eslint-disable @typescript-eslint/no-explicit-any */
import { Indexes, RawMatch } from '../../../../types/classes/context';
import { DocumentType } from '../../../../types/classes/loader.js';
import { Vectorstore } from './vectorstore.js';
import { telnyx } from '../../../../clients/telnyx.js';
import { TelnyxSimilaritySearchResponse } from '../../../../types/classes/vectorstore';
import { encode } from 'gpt-3-encoder';

export class Telnyx extends Vectorstore {
  INTERCOM_BASE_URL: string;

  constructor() {
    super();
    this.INTERCOM_BASE_URL = 'https://support.telnyx.com/en/articles';
  }

  public async query(query: string, indexes: Indexes[] = this.default_indexes, max_results?: number): Promise<any> {
    if (indexes.length === 0) throw new Error('No indexes (buckets) specified for searching');

    const searchQueries = this.buildSearchQueries(query, indexes, max_results);

    const results = await this.executeSearchQueries(searchQueries).then((results) => {
      return this.processSearchResults(results, searchQueries, indexes);
    });

    // console.log('results', results);
    return results;
  }

  private buildSearchQueries(query: string, indexes: Indexes[], max_results?: number): any[] {
    return indexes.map((index) => {
      const body = {
        bucket_name: index.index,
        num_of_docs: max_results || 3,
        query,
      };

      return {
        promise: telnyx.post('/ai/embeddings/similarity-search', body),
        bucket_name: index.index,
      };
    });
  }

  private async executeSearchQueries(searchQueries: any[]): Promise<any[]> {
    return Promise.allSettled(searchQueries.map((sq) => sq.promise));
  }

  private processSearchResults(results: any[], searchQueries: any[], indexes: Indexes[]): any[] {
    const rejectedResult = results.find((result) => result.status === 'rejected');

    if (rejectedResult) {
      const error = rejectedResult?.reason?.response?.data?.errors?.[0];

      if (error?.code && error?.detail) throw new Error(`[${error?.code}] ${error?.detail}`);
      if (typeof error === 'string') throw new Error(error);

      console.log('Failed to get similarity search results', results?.[0]?.reason?.response?.data?.errors || results);
      throw new Error('An unexpected error occured whilst processing the similiarity search results.');
    }

    let matches = this.extractMatchesFromResults(results, searchQueries);

    if (indexes.some((x) => x.weight !== 1)) {
      matches = this.applyWeightsToMatches(matches, indexes);
    }

    // console.log('matches', matches);

    return matches.sort((a, b) => b.certainty - a.certainty);
  }

  private extractMatchesFromResults(results: any[], searchQueries: any[]): any[] {
    return results
      .map((result, index) =>
        result.status === 'fulfilled'
          ? result.value.data.data.map((match) => this.formatMatch(match, searchQueries[index].bucket_name))
          : []
      )
      .flat(100)
      .filter((v, i, a) => a.findIndex((v2) => v2.identifier === v.identifier) === i);
  }

  private formatMatch(match: TelnyxSimilaritySearchResponse, bucket_name: string): RawMatch {
    const filename = match.metadata.filename;
    const content = match.document_chunk;
    const loader_metadata = match.metadata.loader_metadata;

    const defaultFormat = {
      identifier: filename,
      chunk: {
        heading: null,
        content: content,
        tokens: encode(content).length,
        bucket: bucket_name,
        certainty: match.metadata.certainty,
      },
      type: DocumentType.telnyx,
      loader_metadata,
      loader_type: TelnyxLoaderType.UnstructuredText,
    };

    // If the match is using the Intercom Loader
    if (this.isIntercomMatch(loader_metadata)) {
      const heading = loader_metadata.heading.replaceAll('\n', '').trim();
      const chunk = {
        heading,
        content: content.replace(heading, ''),
        tokens: encode(content.replace(heading, '')).length,
        bucket: bucket_name,
        certainty: match.metadata.certainty,
      };

      return { ...defaultFormat, chunk, loader_metadata, loader_type: TelnyxLoaderType.Intercom };
    }

    if (this.isCSVMatch(filename)) {
      return { ...defaultFormat, loader_type: TelnyxLoaderType.CSV };
    }

    if (this.isJsonMatch(filename, content)) {
      return { ...defaultFormat, loader_type: TelnyxLoaderType.JSON };
    }

    // If the match is using a markdown file
    if (this.isMarkdownMatch(filename)) {
      return { ...defaultFormat, loader_type: TelnyxLoaderType.Markdown };
    }

    // If the match is using a pdf file
    if (this.isPDFMatch(filename)) {
      return { ...defaultFormat, loader_type: TelnyxLoaderType.PDF };
    }

    return defaultFormat;
  }

  private applyWeightsToMatches(matches: any[], indexes: Indexes[]): any[] {
    matches.forEach((match) => {
      const index = indexes.find((index) => index.index === match.bucket_name);
      if (index && index.weight !== 1) {
        match.certainty *= index.weight;
      }
    });

    return matches;
  }

  private isPDFMatch = (identifier: string): boolean => identifier.endsWith('.pdf');
  private isMarkdownMatch = (identifier: string): boolean => identifier.endsWith('.md');
  private isCSVMatch = (identifier: string): boolean => identifier.endsWith('.csv');

  private isJsonMatch = (identifier: string, content: string): boolean => {
    if (identifier.endsWith('.json')) return true;

    try {
      JSON.parse(content);
      return true;
    } catch {
      return false;
    }
  };

  private isIntercomMatch = (metadata: TelnyxLoaderMetadata): boolean => {
    if (!('article_id' in metadata) || typeof metadata?.article_id !== 'string') return false;
    if (!('title' in metadata) || typeof metadata?.title !== 'string') return false;
    if (!('url' in metadata) || typeof metadata?.url !== 'string') return false;
    if (!('updated_at' in metadata) || typeof metadata?.updated_at !== 'string') return false;
    if (!('heading' in metadata) || typeof metadata?.heading !== 'string') return false;

    return true;
  };
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

type TelnyxLoaderMetadata = TelnyxLoaderIntercomMetadata | null;

export type TelnyxBucketChunk = {
  heading: string | null;
  content: string;
  tokens: number;
};
