import { TelnyxBucketChunk } from '../types';

export abstract class Splitter {
  chunks: TelnyxBucketChunk[];

  split() {
    throw new Error("Method 'split' must be implemented.");
  }
}
