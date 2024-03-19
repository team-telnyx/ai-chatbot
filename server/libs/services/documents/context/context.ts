import { CallbackEvent } from '../../types.js';
import { Vectorstore } from '../vectorstore/vectorstore.js';
import {
  FormattedPrompt,
  Indexes,
  Match,
  RawMatch,
  TelnyxBucketChunk,
  TelnyxContextResult,
  TelnyxLoaderType,
} from '../types.js';

import stringSimilarity from 'string-similarity';

// represents how close the token size can be to the max token size
const SAFE_TOKENS = 100;

export abstract class Context {
  vectorstore: Vectorstore;
  callback: (event: CallbackEvent) => void;
  MAX_DOCUMENT_TOKENS: number;
  MIN_CERTAINTY: number;
  MINIMUM_CONTENT_LENGTH: number;

  constructor({ vectorstore }) {
    this.vectorstore = vectorstore;

    // the default total token size that all documents must fit within
    this.MAX_DOCUMENT_TOKENS = 2000;

    // the minimum certainty required for a match to be considered
    this.MIN_CERTAINTY = 0.9;

    this.MINIMUM_CONTENT_LENGTH = 10;
  }

  public abstract prompt(matches: Match[], max_tokens?: number): Promise<TelnyxContextResult>;
  public abstract describe(matches: Match[]): Promise<TelnyxContextResult>;
  public abstract matches(query: string, indexes: Indexes[], max_results?: number, min_certainty?: number);
  public abstract matchToDocument(match: RawMatch);
  public abstract matchesToDocuments(matches: RawMatch[]);

  /**
   * Convert a list of chunks to a markdown string
   * @param match The document that contains the chunks
   * @returns The markdown string
   */

  public format(match: Match): string {
    if (match?.override) {
      return match?.override;
    }

    const loaderTypesWithoutHeaders = [TelnyxLoaderType.UnstructuredText];
    const isUnstructuredText = loaderTypesWithoutHeaders.includes(match.loader_type);

    if (isUnstructuredText) {
      const { chunks } = match;
      return chunks.map((chunk) => chunk.content).join('');
    }

    const { url, title, description, chunks } = match;

    let output =
      title && url && description
        ? `# ${title} ([link](${url}))\n${description}\n\n`
        : `# ${match.identifier}\nThis file is being represented as unstructured text. It has no title, description or URL defined.\n\n`;

    for (const chunk of chunks) {
      if (chunk.heading) output += `### ${chunk.heading}\n${chunk.content}\n\n`;
      else output += `${chunk.content}\n\n`;
    }

    return output;
  }

  /**
   * Out of the top matches, determines which matches fit in the prompt size and returns the markdown string
   * @param matches The top matches
   * @param max_tokens The maximum token size of the prompt
   * @returns The markdown equivalent of all matches that fit within the prompt size
   */

  public trimMatches(matches: Match[], max_tokens: number): FormattedPrompt {
    const formattedMatches: { title: string; url: string; tokens: number | string }[] = [];

    let totalTokens = 0;
    let context = '';

    const MAX_SAFE_TOKENS = max_tokens - SAFE_TOKENS;

    // Ensure matches are sorted by certainty in descending order
    matches.sort((a, b) => b.matched.chunk.certainty - a.matched.chunk.certainty);

    for (const match of matches) {
      const matchTotalTokens = match.chunks.reduce((acc, curr) => acc + (curr.tokens || 0), 0);

      if (totalTokens + matchTotalTokens <= MAX_SAFE_TOKENS) {
        // If the entire document can fit, add it in its entirety.
        formattedMatches.push({ title: match.title, url: match.url, tokens: matchTotalTokens });
        context += this.format(match);
        totalTokens += matchTotalTokens;
      } else {
        const remainingTokens = MAX_SAFE_TOKENS - totalTokens;
        const startingChunkIndex = this.findStartingChunk(match, match.matched.chunk.content);
        const chunksToInclude = this.shortenDocument(match.chunks, startingChunkIndex ?? 0, remainingTokens);

        const tokens_used = chunksToInclude.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
        if (tokens_used > 0 && tokens_used <= remainingTokens) {
          formattedMatches.push({
            title: match.title,
            url: match.url,
            tokens: `${tokens_used} / ${matchTotalTokens}`,
          });

          context += this.format({ ...match, chunks: chunksToInclude });
          totalTokens += tokens_used;
        }

        // Since we're adding documents until we reach MAX_SAFE_TOKENS, break after the split attempt
        break;
      }

      // If we've reached or exceeded MAX_SAFE_TOKENS, stop processing further documents
      if (totalTokens >= MAX_SAFE_TOKENS) break;
    }

    return { context, used: formattedMatches };
  }

  /**
   * Used to determine which chunk in a document was matched by similarity search
   * Because the similarity search splits dont match our own splits, this function is used to determine the correct chunk
   * Once the correct chunk has been determined, we can split the entire document around that chunk
   * @param match The match of the document that was found
   * @param originalContent The text content that was matched
   * @param isHeader A boolean representing whether we are checking the header or the content of the match
   * @returns The index of the chunk that was matched
   *
   * @TODO Use a different method for finding the start chunk of CSV or JSON content
   */

  private findStartingChunk(match: Match, originalContent: string, isHeader = false): number | null {
    if (!originalContent || typeof originalContent !== 'string') return null;

    if (originalContent.trim().length < this.MINIMUM_CONTENT_LENGTH) {
      if (!isHeader) {
        return this.findStartingChunk(match, match.matched.chunk.heading, true);
      }
      return null;
    }

    let bestMatchIndex = -1;
    let highestScore = 0;

    match.chunks.forEach((chunk, index) => {
      const textToCompare = isHeader ? chunk.heading : chunk.content;
      const similarityScore = stringSimilarity.compareTwoStrings(originalContent, textToCompare);

      if (similarityScore > highestScore) {
        highestScore = similarityScore;
        bestMatchIndex = index;
      }
    });

    return bestMatchIndex;
  }

  /**
   * If an articles chunks are too long, shorten it by removing chunks
   * We shorten by taking the neighbouring chunks to the matched chunks until we can't fit anymore
   * @param input The input to shorten
   * @param start_index The chunk to start shortening from
   * @param max_tokens The total token size that all chunks can equal
   * @returns The chunks that fit within the token size
   */

  private shortenDocument(input: TelnyxBucketChunk[], start_index: number, max_tokens: number): TelnyxBucketChunk[] {
    let remaining_tokens = max_tokens - (input[start_index].tokens || 0); // Deduct tokens of the start_index chunk
    const output = [input[start_index]]; // Start with the chunk at start_index

    let down_index = start_index - 1;
    let up_index = start_index + 1;

    // While there are chunks above or below the starting index and tokens remain
    while ((down_index >= 0 || up_index < input.length) && remaining_tokens > 0) {
      let added = false;

      // Try to add chunk from above if we have not exceeded the index and have enough tokens
      if (down_index >= 0) {
        const tokens = input[down_index].tokens || 0;
        if (tokens <= remaining_tokens) {
          output.unshift(input[down_index]);
          remaining_tokens -= tokens;
          down_index--; // Move to the next chunk above
          added = true;
        }
      }

      // Try to add chunk from below if we have not exceeded the index and have enough tokens
      if (up_index < input.length && remaining_tokens > 0) {
        const tokens = input[up_index].tokens || 0;
        if (tokens <= remaining_tokens) {
          output.push(input[up_index]);
          remaining_tokens -= tokens;
          up_index++; // Move to the next chunk below
          added = true;
        }
      }

      // If we didn't add any chunks in this iteration, break the loop to prevent infinite looping
      if (!added) {
        break;
      }
    }

    return output;
  }
}
