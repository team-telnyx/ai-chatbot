import { Splitter } from './splitter.js';
import { encode } from 'gpt-3-encoder';
import { TelnyxBucketChunk } from '../vectorstore/telnyx.js';

export class PDFSplitter extends Splitter {
  file: string;

  constructor({ file }) {
    super();

    this.file = file;
    this.paragraphs = this.split();
  }

  /**
   * Splits a PDF by pages unless a page is greater than 2000 tokens, then it will split the page too
   * @returns A list of chunks representing the PDF
   */

  split(): TelnyxBucketChunk[] {
    const result: TelnyxBucketChunk[] = [];

    const chunks = this.file.split('\n');

    for (const chunk of chunks) {
      const encodedLength = encode(chunk).length;

      if (encodedLength > 2000) {
        const chunksByText = this.splitOnText(chunk, 1000);
        for (const textChunk of chunksByText) {
          result.push(textChunk);
        }
      } else {
        result.push({
          heading: null,
          content: chunk,
          tokens: encodedLength,
        });
      }
    }

    return result;
  }

  /**
   * Used to split a PDF page into multiple splits if the page is too large
   * @param content The PDF content to split
   * @param chunkSize The chunk size to make the splits
   * @returns A list of chunks representing the PDF page
   */

  splitOnText(content: string, chunkSize = 1000): TelnyxBucketChunk[] {
    const result: TelnyxBucketChunk[] = [];

    for (let i = 0; i < content.length; i += chunkSize) {
      const chunkContent = content.substring(i, i + chunkSize);
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
