/* eslint-disable @typescript-eslint/no-explicit-any */
import { Splitter } from './splitter.js';
import { encode } from 'gpt-3-encoder';
import { TelnyxBucketParagraph } from '../vectorstore/telnyx.js';

import csvToJsonV2 from 'csvtojson/v2/index.js';

interface KeyValue {
  key: string;
  value: string;
}

export class JSONSplitter extends Splitter {
  file: string;

  constructor({ file }) {
    super();

    this.file = file;
  }

  /**
   * Splits a JSON object into paragraphs of key/value pairs where the value is a string
   * @returns A list of paragraphs derrived from the JSON object
   */

  async split(convertFromCsv = false): Promise<TelnyxBucketParagraph[]> {
    const data = convertFromCsv
      ? this.extractStringValues(await this.csvToJson())
      : this.extractStringValues(this.file);

    const result = [];

    for (const item of data) {
      const chunk: TelnyxBucketParagraph = {
        heading: item.key,
        content: item.value,
        tokens: encode(`${item.key}\n${item.value}`).length,
      };

      result.push(chunk);
    }

    return result;
  }

  public async csvToJson(): Promise<any> {
    const csvAsJson = await new Promise((resolve) => {
      csvToJsonV2({ output: 'json' })
        .fromString(this.file)
        .then((data) => {
          resolve(data);
        });
    });

    return csvAsJson;
  }

  private extractStringValues(obj: any): KeyValue[] {
    const result: KeyValue[] = [];

    function recurse(currentObj: any): void {
      if (currentObj && typeof currentObj === 'object') {
        Object.entries(currentObj).forEach(([key, value]) => {
          if (typeof value === 'string') result.push({ key, value });
          else recurse(value);
        });
      }
    }

    recurse(obj);
    return result;
  }
}
