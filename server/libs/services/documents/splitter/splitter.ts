import { TelnyxBucketChunk } from '../vectorstore/telnyx';

export abstract class Splitter {
  paragraphs: TelnyxBucketChunk[];

  split() {
    throw new Error("Method 'split' must be implemented.");
  }
}
