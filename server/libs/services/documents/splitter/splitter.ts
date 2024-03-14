import { Paragraph } from '../../../../types/classes/loader';

export abstract class Splitter {
  paragraphs: Paragraph[];

  split() {
    throw new Error("Method 'split' must be implemented.");
  }
}
