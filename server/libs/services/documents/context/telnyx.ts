import PDFParser from 'pdf2json';

import { AxiosInstance } from 'axios';
import { Context } from './context.js';
import { MarkdownSplitter } from '../splitter/markdown.js';
import { IntercomSplitter } from '../splitter/intercom.js';
import { us_central_1 } from '../../../../clients/telnyx.js';
import { UnstructuredTextSplitter } from '../splitter/unstructured.js';
import { JSONSplitter } from '../splitter/json.js';
import { PDFSplitter } from '../splitter/pdf.js';

import {
  Indexes,
  TelnyxDocument,
  RawMatch,
  TelnyxContextResult,
  TelnyxLoaderType,
  TelnyxChunkedDocument,
  DocumentType,
  TelnyxBucketChunk,
} from '../types.js';

export class TelnyxContext extends Context {
  client: AxiosInstance;

  constructor({ vectorstore }) {
    super({ vectorstore });
    this.client = us_central_1;
  }

  /**
   * Converts a string input into an array of document matches using vectorstore similiarity search
   * @param query The input search for the vector query
   * @param indexes The indexes to search
   * @returns An array of document matches
   */

  public async matches(
    query: string,
    indexes: Indexes[] = [],
    max_results?: number,
    min_certainty: number = this.MIN_CERTAINTY
  ): Promise<TelnyxDocument[]> {
    try {
      const vector_start = performance.now();
      const raw_matches = await this.vectorstore.query(query, indexes, max_results);
      const vector_end = performance.now();

      if (this.callback)
        this.callback({
          type: 'timer',
          value: { name: 'Vector Query', duration: (vector_end - vector_start) / 1000 },
        });

      const enrich_start = performance.now();

      const valid_raw_matches = raw_matches.filter((match) => match.chunk.certainty > min_certainty);
      if (valid_raw_matches.length === 0) return [];

      // converts the matches back into Telnyx documents
      const documents = await this.matchesToDocuments(valid_raw_matches);
      const matches = documents.sort((a, b) => b.matched.chunk.certainty - a.matched.chunk.certainty);

      const enrich_end = performance.now();

      if (this.callback) {
        this.callback({
          type: 'timer',
          value: { name: 'Enrich Results', duration: (enrich_end - enrich_start) / 1000 },
        });

        // send matches to the frontend over the SSE connection
        this.callback({
          type: 'matches',
          value: matches.map((match) => ({
            title: match.title,
            url: match.url,
            type: match.type,
            certainty: match.matched.chunk.certainty,
            tokens: match.total_tokens,
          })),
        });
      }

      return matches;
    } catch (e) {
      console.log(e);
      throw new Error(e?.message || 'An unexpected error occured');
    }
  }

  /**
   * Queries the vectorstore for matches without any additional processing
   * @param query The query to send
   * @param indexes The indexes or buckets to search
   * @param max_results The max number of results to return
   * @returns The matches returned by the vectorstore search
   */

  public async raw_matches(query: string, indexes: Indexes[] = undefined, max_results?: number): Promise<RawMatch[]> {
    return this.vectorstore.query(query, indexes, max_results);
  }

  /**
   * Helper function to convert matches back into documents
   * @param matches The matches to convert
   * @returns The original documents of the matches
   */

  public async matchesToDocuments(matches: RawMatch[]): Promise<TelnyxDocument[]> {
    if (matches.length === 0) return [];

    const documentPromises = matches.map((match) => this.matchToDocument(match));
    const results = await Promise.all(documentPromises);

    // Filter out nulls from unsuccessful promises
    const documents = results.filter((result) => result !== null);

    if (!documents.length) {
      throw new Error('No documents were successfully processed.');
    }

    return documents;
  }

  /**
   * Transforms a match into the original document
   * @param match The raw match returned from the similarity search
   * @returns The full document that was matched
   */

  private async matchToDocument(match: RawMatch): Promise<TelnyxDocument> {
    const bucket = match.chunk.bucket;
    const document_id = match.identifier;

    const url = `/${bucket}/${encodeURIComponent(document_id)}`;
    const requestHead = await this.client.head(url);
    const contentType = requestHead.headers['content-type'];

    let data = null;

    if (contentType === 'application/pdf') {
      data = await this.pdfToDocument(match);
    } else {
      const request = await this.client.get(url);
      data = request.data;
    }

    const document = await this.getChunkedDocument(match, data);

    return {
      body: document.body,
      identifier: document.identifier,
      type: DocumentType.telnyx,
      url: document.url || match.url || null,
      title: document.title,
      description: document.description,
      chunks: document.chunks,
      total_tokens: document.total_tokens,
      override: document.override,
      loader_type: match.loader_type,
      matched: match,
    };
  }

  /**
   * Describe a list of matches using a markdown string
   * @param matches The list of matches to describe
   * @returns A markdown string describing the matches
   */

  public async describe(matches: TelnyxDocument[]): Promise<TelnyxContextResult> {
    if (matches.length === 0) return { context: '', used: [] };

    // Potential to update to Telnyx summary endpoint if it gets faster at processing documents
    // https://developers.telnyx.com/api/inference/inference-embedding/post-summary

    const descriptions = matches.map((match) => this.describeMatch(match));

    return {
      context: descriptions.join('\n\n'),
      used: matches.map((match) => ({
        title: match.title,
        url: match.url,
        tokens: match.total_tokens,
      })),
    };
  }

  /**
   * Describes the content of a matched document
   * @param match The match to describe
   * @returns The description of the match in markdown format
   */

  private describeMatch(match: TelnyxDocument): string {
    const { identifier, title, description, url, chunks } = match;

    const metadata = [`# Document ID: ${identifier}`, `- Type: \`telnyx\``];

    if (title) metadata.push(`- Title: ${title}`);
    if (description) metadata.push(`- Description: ${description.replaceAll('\n', ' ')}`);
    if (url) metadata.push(`- URL: ${url}`);

    if (this.isJsonArray(match.body) || Array.isArray(match.body)) {
      return [...metadata, `- JSON Keys: [${Object.keys(match?.body?.[0])}]`].join('\n');
    }

    // If the chunks have headings, add the first 30 headings
    if (chunks.length && !chunks.every((chunk) => chunk.heading === null)) {
      metadata.push(
        `- Chunk Headings: [${chunks
          .map((para) => `"${para.heading}"`)
          .filter((chunk) => chunk.trim().length > 0)
          .slice(0, 30)
          .join(', ')}]`
      );
    }

    // If the chunks dont have headings and there is more than 30, add the first 30 chunks with the first 50 characters of each
    if (chunks.length && chunks.every((chunk) => chunk.heading === null) && chunks.length > 30) {
      metadata.push(
        `- Start Of Chunks: [${chunks
          .map((para) => `"${para.content.slice(0, 50)}"`)
          .filter((chunk) => chunk.trim().length > 0)
          .slice(0, 30)
          .join(', ')}]`
      );
    }

    // If the chunks dont have headings and there is less than 30, add the first 30 chunks with the first 600 characters of each
    if (chunks.length && chunks.every((chunk) => chunk.heading === null) && chunks.length <= 30) {
      metadata.push(
        `- Start Of Chunks: [${chunks
          .map((para) => `"${para.content.slice(0, 600)}"`)
          .filter((chunk) => chunk.trim().length > 0)
          .join(', ')}]`
      );
    }

    return metadata.join('\n');
  }

  /**
   * The PDF files needs to be run through a PDF parser to extract the text content
   * @param match The matches from the PDF file to extract the text from
   * @returns The text of the matched PDF document
   */

  private async pdfToDocument(match: RawMatch): Promise<string> {
    const bucket = match.chunk.bucket;
    const document_id = match.identifier;
    const url = `/${bucket}/${encodeURIComponent(document_id)}`;
    const pdfParser = new PDFParser();

    const request = await this.client.get(url, { responseType: 'arraybuffer' });
    const dataBuffer = Buffer.from(request.data);

    const data = await new Promise((resolve, reject) => {
      pdfParser.on('pdfParser_dataError', (errData) => reject(new Error(errData)));
      pdfParser.on('pdfParser_dataReady', (pdfData) => {
        const textContent = pdfData.Pages.map((page) =>
          page.Texts.map((text) => decodeURIComponent(text.R.map((r) => r.T).join(' '))).join(' ')
        ).join('\n');

        resolve(textContent);
      });

      pdfParser.parseBuffer(dataBuffer);
    });

    return data as string;
  }

  /**
   * Takes the text content of a Telnyx document and returns it as a chunked document
   * @param match The match to convert to a document and chunk
   * @param document The full document context in string format
   * @returns A document with chunks representing the document content
   */

  private async getChunkedDocument(match: RawMatch, document: any): Promise<TelnyxChunkedDocument> {
    const { identifier: document_id, loader_type } = match;

    let splitter = undefined;
    let splitParams = undefined;
    let additionalProps = {};
    let telnyxDocumentData = document;

    switch (loader_type) {
      case TelnyxLoaderType.Markdown:
        const { url, title, description, body } = this.formatSEO(document);
        splitter = new MarkdownSplitter({ file: { body } });
        additionalProps = { url, title, description, body };
        break;
      case TelnyxLoaderType.Intercom:
        splitter = new IntercomSplitter({ article: document });
        additionalProps = {
          title: document.title,
          description: document.description,
          url: document.url,
          body: document.body,
        };
        break;
      case TelnyxLoaderType.UnstructuredText:
        splitter = new UnstructuredTextSplitter({ file: document });
        break;
      case TelnyxLoaderType.PDF:
        splitter = new PDFSplitter({ file: document });
        break;
      case TelnyxLoaderType.JSON:
        splitter = new JSONSplitter({ file: document });
        break;
      case TelnyxLoaderType.CSV:
        splitter = new JSONSplitter({ file: document });
        telnyxDocumentData = await splitter.csvToJson();
        splitParams = true;
        break;
      default:
        return {
          identifier: document_id,
          url: null,
          title: null,
          description: null,
          body: document,
          chunks: [],
          total_tokens: 0,
        };
    }

    const chunks = await splitter.split(splitParams);
    const total_tokens = chunks.reduce((total: number, chunk: TelnyxBucketChunk) => total + chunk.tokens, 0);

    return {
      identifier: document_id,
      url: null,
      title: null,
      description: null,
      body: telnyxDocumentData,
      chunks: chunks,
      total_tokens: total_tokens,
      ...additionalProps,
    };
  }

  /**
   * Removes the SEO from the content and returns it as a JSON object.
   * @param body The content with an SEO
   * @returns The SEO as a JSON object and body without it
   */

  private formatSEO = (body) => {
    try {
      const seo_regex = /---\nseo:\n[\s\S]*?---/g;
      const title_regex = /title:[\s\S]*?\n/g;
      const url_regex = /url:[\s\S]*?\n/g;
      const description_regex = /description:[\s\S]*?\n/g;
      const keywords_regex = /keywords:[\s\S]*?\n/g;

      const [seo] = body.match(seo_regex);

      const title = seo.match(title_regex);
      const url = seo.match(url_regex);
      const description = seo.match(description_regex);
      const keywords = seo.match(keywords_regex);

      return {
        title: title?.[0]?.replace('title: ', '').replace(/\\|\"|\'|\n/g, '') || 'No Title',
        description: description?.[0]?.replace('description: ', '').replace(/\\|\"|\'|\n/g, '') || 'No Description',
        url: url?.[0]?.replace('url: ', '').replace(/\\|\"|\'|\n/g, '') || 'No URL Found',
        keywords: keywords?.[0]?.replace('keywords: ', '').replace(/\\|\"|\'|\n/g, '') || 'No Keywords',
        body: body.replace(seo_regex, ''),
      };
    } catch (e) {
      return {
        title: 'No Title',
        description: 'No Description',
        keywords: 'No Keywords',
        body,
      };
    }
  };

  private isJsonArray = (input: string) => {
    try {
      const result = JSON.parse(input);
      return Array.isArray(result);
    } catch (e) {
      try {
        return Array.isArray(input && Object.keys(input).length > 0);
      } catch (err) {
        return false;
      }
    }
  };
}
