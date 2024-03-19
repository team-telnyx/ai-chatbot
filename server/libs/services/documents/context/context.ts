import { FormattedPrompt, Indexes, Match, PromptType, RawMatch } from '../../../../types/classes/context.js';
import { CallbackEvent } from '../../../../types/common.js';
import { Vectorstore } from '../vectorstore/vectorstore.js';
import { DownstreamError } from './errors.js';
import { TelnyxBucketChunk, TelnyxLoaderType } from '../vectorstore/telnyx.js';

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

  public abstract describe(matches: Match[]): Promise<PromptType>;
  public abstract matchToDocument(match: RawMatch);
  public abstract matchesToDocuments(matches: RawMatch[]);

  /**
   * Converts an array of matches into a stringified prompt for the language model
   * @param matches An array of vectorstore matches
   * @param max_tokens Prevents the returned string from exceeding the token limit set
   * @returns A string of documents, readable by the LLM
   */

  public async prompt(matches: Match[], max_tokens = this.MAX_DOCUMENT_TOKENS): Promise<PromptType> {
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

      return { error: DownstreamError(detail, message) };
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
            certainty: match.matched.certainty,
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
   * Convert a list of paragraphs to a markdown string
   * @param match The document that contains the paragraphs
   * @returns The markdown string
   */

  public format(match: Match): string {
    if (match?.override) {
      return match?.override;
    }

    const loaderTypesWithoutHeaders = [TelnyxLoaderType.UnstructuredText];
    const isUnstructuredText = loaderTypesWithoutHeaders.includes(match.loader_type);

    if (isUnstructuredText) {
      const { paragraphs } = match;
      return paragraphs.map((paragraph) => paragraph.content).join('');
    }

    const { url, title, description, paragraphs } = match;

    let output =
      title && url && description
        ? `# ${title} ([link](${url}))\n${description}\n\n`
        : `# ${match.identifier}\nThis file is being represented as unstructured text. It has no title, description or URL defined.\n\n`;

    for (const paragraph of paragraphs) {
      if (paragraph.heading) output += `### ${paragraph.heading}\n${paragraph.content}\n\n`;
      else output += `${paragraph.content}\n\n`;
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
    matches.sort((a, b) => b.matched.certainty - a.matched.certainty);

    for (const match of matches) {
      const matchTotalTokens = match.paragraphs.reduce((acc, curr) => acc + (curr.tokens || 0), 0);

      if (totalTokens + matchTotalTokens <= MAX_SAFE_TOKENS) {
        // If the entire document can fit, add it in its entirety.
        formattedMatches.push({ title: match.title, url: match.url, tokens: matchTotalTokens });
        context += this.format(match);
        totalTokens += matchTotalTokens;
      } else {
        const remainingTokens = MAX_SAFE_TOKENS - totalTokens;
        const startingParagraphIndex = this.findStartingParagraph(match, match.matched.content);
        const paragraphsToInclude = this.shortenDocument(
          match.paragraphs,
          startingParagraphIndex ?? 0,
          remainingTokens
        );

        const tokens_used = paragraphsToInclude.reduce((acc, curr) => acc + (curr.tokens || 0), 0);
        if (tokens_used > 0 && tokens_used <= remainingTokens) {
          formattedMatches.push({
            title: match.title,
            url: match.url,
            tokens: `${tokens_used} / ${matchTotalTokens}`,
          });

          context += this.format({ ...match, paragraphs: paragraphsToInclude });
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
   * Used to determine which paragraph in a document was matched by similarity search
   * Because the similarity search splits dont match our own splits, this function is used to determine the correct paragraph
   * Once the correct paragraph has been determined, we can split the entire document around that paragraph
   * @param match The match of the document that was found
   * @param originalContent The text content that was matched
   * @param isHeader A boolean representing whether we are checking the header or the content of the match
   * @returns The index of the paragraph that was matched
   *
   * @TODO Use a different method for finding the start paragraph of CSV or JSON content
   */

  private findStartingParagraph(match: Match, originalContent: string, isHeader = false): number | null {
    if (!originalContent || typeof originalContent !== 'string') return null;

    if (originalContent.trim().length < this.MINIMUM_CONTENT_LENGTH) {
      if (!isHeader) {
        return this.findStartingParagraph(match, match.matched.heading, true);
      }
      return null;
    }

    let bestMatchIndex = -1;
    let highestScore = 0;

    match.paragraphs.forEach((paragraph, index) => {
      const textToCompare = isHeader ? paragraph.heading : paragraph.content;
      const similarityScore = stringSimilarity.compareTwoStrings(originalContent, textToCompare);

      if (similarityScore > highestScore) {
        highestScore = similarityScore;
        bestMatchIndex = index;
      }
    });

    return bestMatchIndex;
  }

  /**
   * If an articles paragraphs are too long, shorten it by removing paragraphs
   * We shorten by taking the neighbouring paragraphs to the matched paragraph until we can't fit anymore
   * @param input The input to shorten
   * @param start_index The paragraph to start shortening from
   * @param max_tokens The total token size that all paragraphs can equal
   * @returns The paragraphs that fit within the token size
   */

  private shortenDocument(input: TelnyxBucketChunk[], start_index: number, max_tokens: number): TelnyxBucketChunk[] {
    let remaining_tokens = max_tokens - (input[start_index].tokens || 0); // Deduct tokens of the start_index paragraph
    const output = [input[start_index]]; // Start with the paragraph at start_index

    let down_index = start_index - 1; // Initialize down_index to the paragraph before start_index
    let up_index = start_index + 1; // Initialize up_index to the paragraph after start_index

    // While there are paragraphs above or below the starting index and tokens remain
    while ((down_index >= 0 || up_index < input.length) && remaining_tokens > 0) {
      let added = false; // Flag to check if we added a paragraph in this iteration

      // Try to add paragraph from above if we have not exceeded the index and have enough tokens
      if (down_index >= 0) {
        const tokens = input[down_index].tokens || 0;
        if (tokens <= remaining_tokens) {
          output.unshift(input[down_index]); // Add to the beginning
          remaining_tokens -= tokens;
          down_index--; // Move to the next paragraph above
          added = true;
        }
      }

      // Try to add paragraph from below if we have not exceeded the index and have enough tokens
      if (up_index < input.length && remaining_tokens > 0) {
        const tokens = input[up_index].tokens || 0;
        if (tokens <= remaining_tokens) {
          output.push(input[up_index]); // Add to the end
          remaining_tokens -= tokens;
          up_index++; // Move to the next paragraph below
          added = true;
        }
      }

      // If we didn't add any paragraphs in this iteration, break the loop to prevent infinite looping
      if (!added) {
        break;
      }
    }

    return output;
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
}
