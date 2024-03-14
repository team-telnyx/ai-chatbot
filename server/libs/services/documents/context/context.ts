import { encode } from 'gpt-3-encoder';
import { FormattedPrompt, Indexes, Match, PromptType, RawMatch } from '../../../../types/classes/context.js';
import { CallbackEvent } from '../../../../types/common.js';
import { Vectorstore } from '../vectorstore/vectorstore.js';
import { DownstreamError } from './errors.js';
import { TelnyxLoaderType } from '../vectorstore/telnyx.js';

// represents how close the token size can be to the max token size
const SAFE_TOKENS = 100;

export abstract class Context {
  vectorstore: Vectorstore;
  callback: (event: CallbackEvent) => void;
  MAX_DOCUMENT_TOKENS: number;
  MIN_CERTAINTY: number;

  constructor({ vectorstore }) {
    this.vectorstore = vectorstore;

    // the default total token size that all documents must fit within
    this.MAX_DOCUMENT_TOKENS = 2000;

    // the minimum certainty required for a match to be considered
    this.MIN_CERTAINTY = 0.9;
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
    const isPDF = match.loader_type === TelnyxLoaderType.PDF;

    if (isUnstructuredText) {
      const { paragraphs } = match;
      return paragraphs.map((paragraph) => paragraph.content).join('');
    }

    if (isPDF) {
      const { paragraphs } = match;
      let output = ``;

      for (const paragraph of paragraphs) {
        output += `${paragraph.content}`;
      }

      return `\n\n# ${
        match.identifier
      }\nThis file is being represented as unstructured text. It has no description.\n\n${output.replaceAll(
        '\n',
        '\n\n'
      )}`;
    }

    const { url, title, description, paragraphs } = match;

    let output =
      title && url && description
        ? `# ${title} ([link](${url}))\n${description}\n\n`
        : `# ${match.identifier}\nThis file is being represented as unstructured text. It has no description.\n\n`;

    for (const paragraph of paragraphs) {
      if (paragraph.heading) output += `### ${paragraph.heading}\n${paragraph.content}\n\n`;
      else output += `${paragraph.content}\n\n`;
    }

    return output;
  }

  /**
   * Out of the top 3 matches, determines which matches fit in the prompt size and returns the markdown string
   * @param matches The top matches
   * @param max_tokens The maximum token size of the prompt
   * @returns The markdown equivalent of all matches that fit within the prompt size
   *
   * @TODO update this function to also try to determine which paragraph is the match and split around it
   */

  public trimMatches(matches: Match[], max_tokens: number): FormattedPrompt {
    const formattedMatches: { title: string; url: string; tokens: number | string }[] = [];
    let totalTokens = 0;
    let context = '';

    for (const match of matches) {
      const nextTotal = totalTokens + match.total_tokens;

      if (nextTotal <= max_tokens) {
        // Add matches in their entirety as long as they fit
        formattedMatches.push({ title: match.title, url: match.url, tokens: match.total_tokens });
        context += this.format(match);
        totalTokens = nextTotal;
      } else {
        // If this match can't fit in its entirety but we haven't used up all space, try to split it
        const remainingTokens = max_tokens - totalTokens;
        if (remainingTokens > 0 && formattedMatches.length > 0) {
          const { paragraphs, tokens_used } = this.split(match, remainingTokens);
          if (tokens_used > 0) {
            // Ensure split is beneficial
            formattedMatches.push({
              title: match.title,
              url: match.url,
              tokens: `${tokens_used} / ${match.total_tokens}`,
            });
            context += this.format({ ...match, paragraphs });
            totalTokens += tokens_used;
          }
        }
        break;
      }
    }

    if (formattedMatches.length === 0 && matches.length > 0) {
      const match = matches[0];
      const { paragraphs, tokens_used } = this.split(match, max_tokens);
      const used = [{ title: match.title, url: match.url, tokens: `${tokens_used} / ${match.total_tokens}` }];
      return { context: this.format({ ...match, paragraphs }), used };
    }

    return { context, used: formattedMatches };
  }

  /**
   * If a documents paragraphs exceed the token size, remove paragraphs until it doesnt
   * We remove the paragraphs that are the further neighbours to the matched paragraph
   * @param match The matched paragraph of the document
   * @param max_tokens The max tokens that the document can be
   * @returns A list of paragraphs that fit within the token size
   */

  private split(match: Match, max_tokens: number) {
    // We remove a specified number of tokens to allow for any unexpected overflow
    const MAX_TOKENS_SAFE = max_tokens - SAFE_TOKENS;
    const index = match.paragraphs.findIndex((paragraph) => paragraph.content === match.matched.content);

    const { title, description, url, paragraphs, matched } = match;

    const heading = `# Metadata\n* Title: ${title}\n* Description: ${description}\n* URL: ${url}\n\n`;
    const heading_tokens = encode(heading)?.length;

    // max safe tokens - the tokens for the heading - the tokens for the matched paragraph
    const matched_paragraph_tokens = encode(`${matched.heading}\n${matched.content}\n\n`).length;
    const remaining_tokens = MAX_TOKENS_SAFE - heading_tokens - matched_paragraph_tokens;

    const shortened_articles = this.shortenDocument(paragraphs, index, remaining_tokens);
    const tokens_used = shortened_articles.map((item) => item.tokens).reduce((a, b) => a + b, 0);

    return { paragraphs: shortened_articles, tokens_used: tokens_used };
  }

  /**
   * If an articles paragraphs are too long, shorten it by removing paragraphs
   * We shorten by taking the neighbouring paragraphs to the matched paragraph until we can't fit anymore
   * @param input The input to shorten
   * @param start_index The paragraph to start shortening from
   * @param max_tokens The total token size that all paragraphs can equal
   * @returns The paragraphs that fit within the token size
   */

  private shortenDocument(input, start_index, max_tokens) {
    const down_options = input.slice(0, start_index).length;
    const up_options = input.slice(start_index + 1, input.length).length;

    let down_index = 0;
    let up_index = 0;
    let remaining_tokens = max_tokens;

    let output = [input[start_index]];

    while (down_index < down_options || up_index < up_options) {
      if (up_index >= down_index || up_index === up_options) {
        const add = input[start_index - 1 - down_index];
        if (add && add.tokens <= remaining_tokens) {
          output = [...output, add];
          remaining_tokens -= add.tokens;
        }

        down_index += 1;
      }

      if (down_index > up_index || down_index === 0) {
        const add = input[start_index + 1 + up_index];
        if (add && add.tokens <= remaining_tokens) {
          output = [add, ...output];
          remaining_tokens -= add.tokens;
        }

        up_index += 1;
      }
    }

    return output.reverse().filter((item) => item);
  }

  /**
   * Convert a vectorstore match into the original document
   * @param raw_matches A list of matches
   * @returns A list of original documents
   */

  private async enrich(raw_matches: RawMatch[], min_certainty: number): Promise<Match[]> {
    const matches = raw_matches.filter((match) => match.certainty > min_certainty);
    if (matches.length === 0) return [];

    const documents = await this.matchesToDocuments(matches);

    // sort documents by certainty
    return documents.sort((a, b) => b.matched.certainty - a.matched.certainty);
  }
}
