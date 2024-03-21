import dotenv from 'dotenv';

import { Application } from './libs/app/application.js';

dotenv.config();

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const app = new Application();

// Start the server
app.start(port);

// Properly dispose of the server when the process is terminated
process.on('SIGINT', () => {
  app.dispose();
});

export const application = app
