import { Application } from './libs/app/application.js';

const port = 3000;
const app = new Application();

// Start the server
app.start(port);

// Properly dispose of the server when the process is terminated
process.on('SIGINT', () => {
  app.dispose();
});
