import dotenv from 'dotenv';

import { Router } from 'express';
import { Datastore } from '../libs/repositories/postgres/datastore.postgres.js';
import { errorMiddleware } from '../libs/app/middleware/error_handler.js';
import { TelnyxContext } from '../libs/services/documents/context/telnyx.js';
import { Telnyx } from '../libs/services/documents/vectorstore/telnyx.js';

const router = Router();
const datastore = new Datastore();

dotenv.config();

router.get('/test', async (req, res) => {
  try {
    const vectorstore = new Telnyx();
    const context = new TelnyxContext({ vectorstore });

    // const query = 'how do I contact Bell?';
    const query = 'how do i send a message with python?';
    const indexes = [
      // { index: 'test-book', weight: 1 },
      { index: 'devdocs', weight: 1 },
      // { index: 'support-docs', weight: 1 },
      // { index: 'json-testing-001', weight: 1 },
      // { index: 'pdf-test-001', weight: 1 },
      // { index: 'json-testing-002', weight: 1 },
      // { index: 'html-test-001', weight: 1 },
      // { index: 'csv-test-001', weight: 1 },
    ];

    // const query = 'who gave Harry his first birthday cake?';
    // const indexes = [{ index: 'devdocs', weight: 1 }];
    // const indexes = [{ index: 'support-docs', weight: 1 }];
    // const indexes = [{ index: 'html-test-001', weight: 1 }];
    // const indexes = [{ index: 'json-testing-001', weight: 1 }];
    // const indexes = [{ index: 'test-book', weight: 1 }];

    const results = await context.matches(query, indexes);
    // return res.json(results);
    const data = await context.prompt(results, 1000);
    return res.send(data.context);
  } catch (e) {
    return res.json({ error: e?.message || 'An unexpected error occurred. Please try again later.' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const start = req.query.start_date as string;
    const end = req.query.end_date as string;
    const conversations = await datastore.getConversations(start, end);

    return res.json(conversations);
  } catch (e) {
    errorMiddleware(e, res);
  }
});

router.get('/messages', async (req, res) => {
  try {
    const start = req.query.start_date as string;
    const end = req.query.end_date as string;
    const messages = await datastore.getMessages(start, end);

    return res.json(messages);
  } catch (e) {
    errorMiddleware(e, res);
  }
});

router.get('/messages/:message_id', async (req, res) => {
  try {
    const message_id = req.params.message_id as string;
    const message = await datastore.getMessage(message_id);

    return res.json(message);
  } catch (e) {
    errorMiddleware(e, res);
  }
});

router.get('/messages/:message_id/metadata', async (req, res) => {
  try {
    const message_id = req.params.message_id as string;
    const metadata = await datastore.getMetadata(message_id);

    return res.json(metadata);
  } catch (e) {
    errorMiddleware(e, res);
  }
});

router.get('/feedback', async (req, res) => {
  try {
    const start = req.query.start_date as string;
    const end = req.query.end_date as string;
    const type = req.query.type as string;
    const feedback = await datastore.getFeedback(start, end, type);

    return res.json(feedback);
  } catch (e) {
    errorMiddleware(e, res);
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const message_id = req.body.message_id;
    const user_id = req.body.user_id;
    const type = req.body.type;

    await datastore.setFeedback(message_id, user_id, type);

    return res.json({ success: true });
  } catch (e) {
    errorMiddleware(e, res);
  }
});

export default router;
