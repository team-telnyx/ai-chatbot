import { describe, expect, test } from '@jest/globals';
import { JSONSplitter } from '../../../libs/services/documents/splitter/json.js';

describe('JSONSplitter Class Tests', () => {
  test('Split JSON by key-value pairs', async () => {
    const data = {
      key1: 'value1',
      key2: 'value2',
    };
    const splitter = new JSONSplitter({
      file: data,
    });

    const result = await splitter.split();

    expect(result).toEqual([
      {
        heading: 'key1',
        content: 'value1',
        tokens: 5,
      },
      {
        heading: 'key2',
        content: 'value2',
        tokens: 5,
      },
    ]);
  });

  test('Split JSON by arrays', async () => {
    const data = [
      {
        key1: 'value1',
      },
      {
        key2: 'value2',
      },
    ];
    const splitter = new JSONSplitter({
      file: data,
    });

    const result = await splitter.split();
    expect(result).toEqual([
      { heading: null, content: '{\n  "key1": "value1"\n}', tokens: 13 },
      { heading: null, content: '{\n  "key2": "value2"\n}', tokens: 13 },
    ]);
  });

  test('Split CSV', async () => {
    const data = `"key1", "key2"
    "value1",  "value2"
    "value3",  "value4"`;

    const splitter = new JSONSplitter({
      file: data,
    });

    const result = await splitter.split(true);

    expect(result).toEqual([
      {
        heading: null,
        content: '{\n  "key1": "value1",\n  "key2": "value2"\n}',
        tokens: 23,
      },
      {
        heading: null,
        content: '{\n  "key1": "value3",\n  "key2": "value4"\n}',
        tokens: 23,
      },
    ]);
  });
});
