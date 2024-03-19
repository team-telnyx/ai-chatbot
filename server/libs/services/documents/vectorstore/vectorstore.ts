import { Indexes, RawMatch } from '../types.js';

export abstract class Vectorstore {
  default_indexes: Indexes[];

  constructor() {
    this.default_indexes = [];
  }

  public async query(
    query: string,
    indexes: Indexes[] = this.default_indexes,
    max_results?: number
  ): Promise<RawMatch[]> {
    console.log('query', query, indexes, max_results);
    throw new Error("Method 'query' must be implemented.");
  }
}
