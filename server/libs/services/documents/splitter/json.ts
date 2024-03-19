/* eslint-disable @typescript-eslint/no-explicit-any */
import { Splitter } from './splitter.js';
import { encode } from 'gpt-3-encoder';

import csvToJsonV2 from 'csvtojson/v2/index.js';
import { TelnyxBucketChunk } from '../types.js';

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
   * If the JSON object is an array, we split by each object
   * If the JSON object is a single object, we split on key/value pairs
   * @param convertFromCsv Set to true to use a CSV as input and convert it to a JSON
   * @returns A list of splits for the JSON object provided
   */

  async split(convertFromCsv = false) {
    const fileContent = convertFromCsv ? await this.csvToJson() : this.file;
    const isArray = Array.isArray(fileContent);

    if (isArray) return this.splitByJsonArray(fileContent);
    else return this.splitByStringValues(fileContent);
  }

  /**
   * Splits a JSON array into individual objects
   * @returns A list of JSON chunks representing each object in the array
   */

  async splitByJsonArray(objects: any): Promise<TelnyxBucketChunk[]> {
    const result = [];

    for (const object of objects) {
      const content = JSON.stringify(object, null, 2);

      const chunk: TelnyxBucketChunk = {
        heading: null,
        content,
        tokens: encode(content).length,
      };

      result.push(chunk);
    }

    return result;
  }

  /**
   * Splits a JSON object into chynks of key/value pairs
   * @returns A list of JSON key/value chunks derrived from the JSON object
   */

  async splitByStringValues(fileContent: any): Promise<TelnyxBucketChunk[]> {
    const data = this.extractStringValues(fileContent);

    const result = [];

    for (const item of data) {
      const chunk: TelnyxBucketChunk = {
        heading: item.key,
        content: item.value,
        tokens: encode(`${item.key}\n${item.value}`).length,
      };

      result.push(chunk);
    }

    return result;
  }

  /**
   * Converts a CSV input into a JSON object
   * @returns The JSON representation of the CSV input
   */

  private async csvToJson(): Promise<any> {
    const csvAsJson = await new Promise((resolve) => {
      csvToJsonV2({ output: 'json' })
        .fromString(this.file)
        .then((data) => {
          resolve(data);
        });
    });

    return csvAsJson;
  }

  /**
   * Extacts key/value pairs from a JSON object if the value is a string
   * @param obj The object to extract pairs from
   * @returns A list of key/value pairs for each string value in the object
   */

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
