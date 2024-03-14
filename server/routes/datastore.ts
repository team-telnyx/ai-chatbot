import dotenv from 'dotenv';

import { Router } from 'express';
import { Datastore } from '../libs/repositories/postgres/datastore.postgres.js';
import { errorMiddleware } from '../libs/app/middleware/error_handler.js';

const router = Router();
const datastore = new Datastore();

dotenv.config();

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
