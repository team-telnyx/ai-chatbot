import path from 'path';
import express, { Express, json, urlencoded, static as expressStatic } from 'express';
import cors from 'cors';
import fs from 'fs';

import completion from '../../routes/completion.js';
import datastore from '../../routes/datastore.js';
import state from '../../routes/state.js';
import pricing from '../../routes/pricing.js';

import { Server } from 'http';
import { OpenAI } from 'openai';
import { config } from 'dotenv';

const __dirname = path.resolve();

config({ override: true });

export class Application {
  public app: Express;

  private server?: Server;

  constructor() {
    this.app = express();

    this.setupMiddlewares();
    this.setupRoutes();
    this.setupGlobalVariables();
  }

  // start the server
  public start(port: number): void {
    this.checkEnvVariables();

    this.server = this.app.listen(port, () => {
      console.log(`Server running on http (port ${port})`);
    });
  }

  public dispose(): void {
    if (this.server) {
      this.server.close(() => {
        console.log('Server has been stopped.');
      });

      // Here you can dispose of any resources that the application uses,
      // for example, database connections, file handles, etc.
    }
  }

  private checkEnvVariables(): void {
    const envFilePath = path.resolve(process.cwd(), '.env');

    if (!this.fileExists(envFilePath)) {
      console.error(`ERROR: .env file does not exist at ${envFilePath}`);
      process.exit(1);
    }

    const requiredEnvVars = [
      'INTERCOM_API_KEY',
      'OPENAI_API_KEY',
      'TELNYX_API_KEY',
      'POSTGRES_HOST',
      'POSTGRES_PORT',
      'POSTGRES_USER',
      'POSTGRES_DATABASE',
      'POSTGRES_PASSWORD',
    ];

    const missingOrEmptyEnvVars = requiredEnvVars.filter((envVar) => {
      return !process.env[envVar] || process.env[envVar].trim() === '';
    });

    if (missingOrEmptyEnvVars.length > 0) {
      console.error(`ERROR: Missing or empty required environment variables: ${missingOrEmptyEnvVars.join(', ')}`);
      console.error('Please ensure all required environment variables are set and have non-empty values.');
      process.exit(1);
    }
  }

  private fileExists(filePath: string): boolean {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      return true;
    } catch (e) {
      return false;
    }
  }

  private setupMiddlewares(): void {
    this.app.use(cors({ credentials: true, origin: '*' }));
    this.app.use(json());
    this.app.use(urlencoded({ extended: true }));
    this.app.use(expressStatic(path.join(__dirname, 'build')));
  }

  private setupRoutes(): void {
    this.app.use('/state', state);
    this.app.use('/completion', completion);
    this.app.use('/datastore', datastore);
    this.app.use('/pricing', pricing);

    // health check
    this.app.get('/health', (req: express.Request, res: express.Response) => {
      return res.json({ status: 'OK' });
    });
  }

  private setupGlobalVariables(): void {
    const openai = new OpenAI({
      baseURL: 'https://api.telnyx.com/v2/ai',
      apiKey: process.env.TELNYX_API_KEY,
    });

    const openai_base = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    this.app.locals.openai = openai;
    this.app.locals.openai_base = openai_base;

    // operational | degraded | maintenance | offline
    this.app.locals.state = {
      status: 'operational',
      notice: null,
    };
  }
}
