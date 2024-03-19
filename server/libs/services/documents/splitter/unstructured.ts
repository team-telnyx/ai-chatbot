import { TelnyxBucketChunk } from '../types.js';
import { Splitter } from './splitter.js';
import { encode } from 'gpt-3-encoder';

export class UnstructuredTextSplitter extends Splitter {
  file: string;

  constructor({ file }) {
    super();

    this.file = file;
    this.chunks = this.split();
  }

  /**
   * Splits an unstructured text document into chunks of size chunk_size
   * @param chunkSize The size of each chunk in characters
   * @returns A list of chunks of size chunk_size
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
