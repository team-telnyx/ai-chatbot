import PDFParser from 'pdf2json';

import { AxiosInstance } from 'axios';
import { Context } from './context.js';
import { encode } from 'gpt-3-encoder';
import { MarkdownSplitter } from '../splitter/markdown.js';
import { IntercomSplitter } from '../splitter/intercom.js';
import { us_central_1 } from '../../../../clients/telnyx.js';
import { DownstreamError } from './errors.js';
import { UnstructuredTextSplitter } from '../splitter/unstructured.js';
import { JSONSplitter } from '../splitter/json.js';
import { PDFSplitter } from '../splitter/pdf.js';
import { Indexes, Match, RawMatch, TelnyxBucketChunk, TelnyxContextResult, TelnyxLoaderType } from '../types.js';

type DocumentSplitter = {
  identifier: string;
  url: string;
  title: string;
  display_title?: string;
  description: string;
  body: string;
  chunks: TelnyxBucketChunk[];
  override?: string;
  total_tokens: number;
};

export class TelnyxContext extends Context {
  client: AxiosInstance;

  constructor({ vectorstore }) {
    super({ vectorstore });
    this.client = us_central_1;
  }

  /**
   * Converts an array of matches into a stringified prompt for the language model
   * @param matches An array of vectorstore matches
   * @param max_tokens Prevents the returned string from exceeding the token limit set
   * @returns A string of documents, readable by the LLM
   * @throws DownstreamError
   */

  public async prompt(matches: Match[], max_tokens = this.MAX_DOCUMENT_TOKENS): Promise<TelnyxContextResult> {
    if (matches.length === 0) return { context: '', used: [] };

    try {
      const start = performance.now();

      const { context, used } = this.trimMatches(matches, max_tokens);
      const end = performance.now();

      if (this.callback) {
        this.callback({ type: 'timer', value: { name: 'Generating Prompt', duration: (end - start) / 1000 } });
        this.callback({ type: 'documents', value: used });
      }

      return { context, used };
    } catch (e) {
      const detail = 'Failed to generate the context.';
      const message = e?.message;

      const msg = DownstreamError(detail, message);
      throw new Error(JSON.stringify(msg));
    }
  }

  /**
   * Converts a string input into an array of matches using vectorstore similiarity search
   * @param query The input to convert
   * @param indexes The indexes to search, all if not specified
   * @returns An array of matches
   */

  public async matches(
    query: string,
    indexes: Indexes[] = [],
    max_results?: number,
    min_certainty: number = this.MIN_CERTAINTY
  ): Promise<Match[]> {
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
      const matches = await this.enrich(raw_matches, min_certainty);
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
   * Convert a vectorstore match into the original document
   * @param raw_matches A list of matches
   * @returns A list of original documents
   */

  private async enrich(raw_matches: RawMatch[], min_certainty: number): Promise<Match[]> {
    const matches = raw_matches.filter((match) => match.chunk.certainty > min_certainty);
    if (matches.length === 0) return [];

    const documents = await this.matchesToDocuments(matches);

    // sort documents by certainty
    return documents.sort((a, b) => b.matched.certainty - a.matched.certainty);
  }

  public async raw_matches(query: string, indexes: Indexes[] = undefined, max_results?: number) {
    return this.vectorstore.query(query, indexes, max_results);
  }

  public async describe(matches: Match[]): Promise<TelnyxContextResult> {
    if (matches.length === 0) return { context: '', used: [] };

    const descriptions = [];
    const used = [];

    for (const match of matches) {
      const { identifier, title, description, url, chunks } = match;
      const metadata = [`# Document ID: ${identifier}`, `- Type: \`telnyx\``];

      if (title) metadata.push(`- Title: ${title}`);
      if (description) metadata.push(`- Description: ${description.replaceAll('\n', ' ')}`);
      if (url) metadata.push(`- URL: ${url}`);
      if (chunks.length) {
        metadata.push(
          `- Paragraph Headings: [${chunks
            .map((para) => `"${para.heading}"`)
            .slice(0, 20)
            .join(', ')}]`
        );
      }

      used.push({ title, url, tokens: encode(metadata.join(`\n`)).length });
      descriptions.push(metadata.join('\n'));
    }

    return { context: descriptions.join('\n\n'), used };
  }

  public async matchesToDocuments(matches: RawMatch[]) {
    if (matches.length === 0) return [];

    const documentPromises = matches.map((match) =>
      this.matchToDocument(match).then((documentData) => ({ ...documentData.document, match }))
    );

    const results = await Promise.all(documentPromises);

    // Filter out nulls from unsuccessful promises
    const documents = results.filter((result) => result !== null);

    if (!documents.length) {
      throw new Error('No documents were successfully processed.');
    }

    return documents.map((item) => ({
      identifier: item.match.identifier,
      type: item.match.type,
      url: item.url,
      title: item.title,
      description: item.description,
      chunks: item.chunks,
      total_tokens: item.total_tokens,
      override: item.override,
      loader_type: item.match.loader_type,
      matched: item.match,
    }));
  }

  /**
   * Transforms a match into a document
   * @param match The enriched match returned from the similarity search
   * @returns The full document that was matched
   */

  public async matchToDocument(match: RawMatch): Promise<TelnyxContextResult> {
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

    const document = await this.formatAndSplit(match, data);
    const context = this.formatTelnyxDocument(document);

    return {
      document,
      context,
      used: [
        {
          title: document.title,
          url: document.url,
          tokens: document.total_tokens,
        },
      ],
    };
  }

  private formatAndSplit = async (match: RawMatch, document: any): Promise<DocumentSplitter> => {
    const document_id = match.identifier;
    const loader_type = match.loader_type;

    if (loader_type === TelnyxLoaderType.Markdown) {
      const { url, title, description, body } = this.formatSEO(document);

      const splitter = new MarkdownSplitter({ file: { body: body } });
      const chunks = splitter.split();

      return {
        identifier: document_id,
        url,
        title,
        description,
        body: body,
        chunks: chunks,
        total_tokens: chunks.reduce((total, chunk) => total + chunk.tokens, 0),
      };
    }

    if (loader_type === TelnyxLoaderType.Intercom) {
      const { title, description, url, body } = document;

      const splitter = new IntercomSplitter({ article: document });
      const chunks = splitter.split();

      return {
        identifier: url,
        url,
        title,
        description,
        body,
        chunks: chunks,
        total_tokens: chunks.reduce((total, chunk) => total + chunk.tokens, 0),
      };
    }

    if (loader_type === TelnyxLoaderType.UnstructuredText) {
      const splitter = new UnstructuredTextSplitter({ file: document });
      const chunks = splitter.split();

      return {
        identifier: document_id,
        url: null,
        title: null,
        description: null,
        body: document,
        chunks: chunks,
        total_tokens: chunks.reduce((total, chunk) => total + chunk.tokens, 0),
      };
    }

    if (loader_type === TelnyxLoaderType.PDF) {
      const splitter = new PDFSplitter({ file: document });
      const chunks = splitter.split();

      return {
        identifier: document_id,
        url: null,
        title: null,
        description: null,
        body: document,
        chunks: chunks,
        total_tokens: chunks.reduce((total, chunk) => total + chunk.tokens, 0),
      };
    }

    if (loader_type === TelnyxLoaderType.JSON) {
      const splitter = new JSONSplitter({ file: document });
      const chunks = await splitter.split();

      return {
        identifier: document_id,
        url: null,
        title: null,
        description: null,
        body: document,
        chunks: chunks,
        total_tokens: chunks.reduce((total, chunk) => total + chunk.tokens, 0),
      };
    }

    if (loader_type === TelnyxLoaderType.CSV) {
      const splitter = new JSONSplitter({ file: document });
      const chunks = await splitter.split(true);

      return {
        identifier: document_id,
        url: null,
        title: null,
        description: null,
        body: document,
        chunks: chunks,
        total_tokens: chunks.reduce((total, chunk) => total + chunk.tokens, 0),
      };
    }

    return {
      identifier: document_id,
      url: null,
      title: null,
      description: null,
      body: document,
      chunks: [],
      total_tokens: 0,
    };
  };

  private formatTelnyxDocument(data): string {
    const { identifier, url, title, description, chunks } = data;

    let output = `# Document ID: ${identifier}\n- Title: ${title}\n- Description: ${description}\n- URL: ${url}\n\n`;

    for (const chunk of chunks) {
      output += `### ${chunk.heading}\n${chunk.content}\n\n`;
    }

    return output;
  }

  private async pdfToDocument(match: RawMatch): Promise<TelnyxContextResult> {
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

    return data;
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
}
