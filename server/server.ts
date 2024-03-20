import dotenv from 'dotenv';

import { Application } from './libs/app/application.js';

dotenv.config();

let port;
try {
  if (!process.env.PORT) throw new Error('PORT is not defined');
  port = parseInt(process.env.PORT);
  if (isNaN(port)) {
    throw new Error('PORT is not a number');
  }
} catch (e) {
  port = 3000;
  console.log(e.message);
  console.log('Using default port 3000');
}

const app = new Application();

// Start the server
app.start(port);

// Properly dispose of the server when the process is terminated
process.on('SIGINT', () => {
  app.dispose();
});

const { app: expressApp } = app;

export { expressApp };
