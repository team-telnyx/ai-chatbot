import { Splitter } from './splitter.js';
import { encode } from 'gpt-3-encoder';
import { TelnyxBucketChunk } from '../vectorstore/telnyx.js';

export class UnstructuredTextSplitter extends Splitter {
  file: string;

  constructor({ file }) {
    super();

    this.file = file;
    this.paragraphs = this.split();
  }

  /**
   * Splits an unstructured text document into paragraphs of size chunk_size
   * @param chunkSize The size of each paragraph in characters
   * @returns A list of paragraphs of size chunk_size
   */

  split(chunkSize = 1000): TelnyxBucketChunk[] {
    const result: TelnyxBucketChunk[] = [];

    for (let i = 0; i < this.file.length; i += chunkSize) {
      const chunkContent = this.file.substring(i, i + chunkSize);
      const encodedLength = encode(chunkContent).length;

      const chunk: TelnyxBucketChunk = {
        heading: null,
        content: chunkContent,
        tokens: encodedLength,
      };

      result.push(chunk);
    }

    return result;
  }
}
