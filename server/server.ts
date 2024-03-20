import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { Application } from './libs/app/application.js';

dotenv.config();

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
}

function parseEnvFile(filePath: string): string[] {
  try {
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    return fileContents.split('\n').filter(line => line.trim() !== '' && !line.startsWith('#')).map(line => line.split('=')[0].trim());
  } catch (error) {
    console.error(`ERROR: Unable to read or parse the .env file at ${filePath}`, error);
    return [];
  }
}

function checkEnvVariables(envFilePath: string): void {
  if (!fileExists(envFilePath)) {
    console.error(`ERROR: .env file does not exist at ${envFilePath}`);
    process.exit(1);
  }

  const envFileVars = parseEnvFile(envFilePath);
  const missingEnvVars = envFileVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.error(`ERROR: Missing required environment variables: ${missingEnvVars.join(', ')}`);
    console.error(`Please ensure all required environment variables are set.`);
    process.exit(1);
  }
}

const envFilePath = path.resolve(process.cwd(), '.env');
checkEnvVariables(envFilePath);

const port = 3000;
const app = new Application();

app.start(port);

process.on('SIGINT', () => {
  app.dispose();
});
