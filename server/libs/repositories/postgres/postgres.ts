/* eslint-disable @typescript-eslint/no-explicit-any */
import Pool from 'pg-pool';

import { config } from 'dotenv';

config();

type StartEndReturn = {
  error: string | null;
  data: any[] | null;
};

export abstract class Postgres {
  db: { [key: string]: any };

  constructor() {
    this.db = {
      chatbot: new Pool({
        max: 50,
        port: process.env.POSTGRES_PORT,
        user: process.env.POSTGRES_USER,
        database: process.env.POSTGRES_DATABASE,
        host: process.env.POSTGRES_HOST,
        password: process.env.POSTGRES_PASSWORD,
        connectionTimeoutMillis: 0,
        idleTimeoutMillis: 10,
      }),
    };

    this.errorHandlers();
  }

  public async transaction(operations: (client: any) => Promise<void>) {
    const client = await this.db['chatbot'].connect();

    try {
      await client.query('BEGIN');
      await operations(client);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  public start_end_query = async (
    database_name: string,
    query_string: string,
    start: string,
    end: string,
    params: string[] = []
  ): Promise<StartEndReturn> => {
    const { start_date, end_date, error: dateError } = this.formatDates(start, end);
    if (dateError) return { data: null, error: dateError };

    const { data, error } = await this.query(database_name, query_string, [start_date, end_date, ...params]);
    if (error) return { data: null, error: JSON.stringify(error) };
    if (!data) return { data: [], error: null };

    return { data, error: null };
  };

  public insert = async (database: string | Pool, table: string, data: any) => {
    const pool = typeof database === 'string' ? this.getDatabase(database) : database;

    try {
      const success = await pool.query(`${this.getQuery(table, data)} ${this.getValues(data)}`, Object.values(data));
      if (success) return { success: true };
    } catch (e) {
      return { success: false, error: this.formatPostgresError(e) };
    }
  };

  public insertIgnoreConflict = async (database: string | Pool, table: string, data: any) => {
    const pool = typeof database === 'string' ? this.getDatabase(database) : database;

    try {
      const success = await pool.query(
        `${this.getQuery(table, data)} ${this.getValues(data)} ON CONFLICT DO NOTHING`,
        Object.values(data)
      );
      if (success) return { success: true };
    } catch (e) {
      return { success: false, error: this.formatPostgresError(e) };
    }
  };

  public query = async (database: string | Pool, query_string: string, data: any[]) => {
    const pool = typeof database === 'string' ? this.getDatabase(database) : database;

    try {
      const result = await pool.query(query_string, data);
      if (!result.rows || result.rows.length === 0) {
        if (query_string.includes('DELETE')) {
          return {
            success: true,
            data: 'The rows were deleted from the table successfully.',
          };
        }

        return { success: true, data: [] };
      }
      return { success: true, data: result.rows };
    } catch (e) {
      return { success: false, error: this.formatPostgresError(e) };
    }
  };

  public update = async (database: string | Pool, table: string, data: any, condition: any) => {
    const pool = typeof database === 'string' ? this.getDatabase(database) : database;

    try {
      const query_string = `UPDATE ${table} ${this.getUpdateValues(data, condition)}`;
      await pool.query(query_string, [...Object.values(data), ...Object.values(condition)]);
      return { error: null };
    } catch (e) {
      return { error: this.formatPostgresError(e) };
    }
  };

  private getUpdateValues = (updateData: any, conditionData: any) => {
    const updates = [];
    let total_index = 1;

    for (const [index, key] of Object.keys(updateData).entries()) {
      updates.push(`${key} = $${index + 1}`);
      total_index += 1;
    }

    return `SET ${updates.join(', ')} WHERE ${Object.keys(conditionData)[0]} = $${total_index};`;
  };

  private getQuery = (table: string, params: any) => `INSERT INTO ${table}(${Object.keys(params).join(', ')})`;

  private getValues = (params: any) => {
    const values = [];
    for (const [index] of Object.keys(params).entries()) values.push(`$${index + 1}`);
    return `VALUES(${values.join(', ')})`;
  };

  private getDatabase = (database_name: string) => {
    try {
      return this.db[database_name];
    } catch (e) {
      return { success: false, error: `The database '${database_name}' does not exist within this service.` };
    }
  };

  private formatPostgresError = (error: any) => ({
    error: error.message,
    detail: error.detail,
    database: {
      table: error.table,
      constraint: error.constraint,
    },
  });

  private errorHandlers = () => {
    for (const key of Object.keys(this.db)) {
      const database = this.db[key];

      database.on('error', (err) => {
        throw err;
      });
    }
  };

  private formatDates = (start: string, end: string) => {
    if (!start) return { error: 'Please provide a start_date as a query parameter.' };
    if (!end) return { error: 'Please provide a end_date as a query parameter.' };

    try {
      const start_date = new Date(Date.parse(start)).toISOString().split('T')[0];
      const end_date = new Date(Date.parse(end)).toISOString().split('T')[0];

      return { start_date, end_date, error: null };
    } catch (e) {
      return { error: 'Failed to parse start_date & end_date. Invalid format provided. Please us YYYY-MM-DD.' };
    }
  };
}
