import { Response } from 'express';

export const errorMiddleware = (e: Error, res: Response) => {
  try {
    const error = JSON.parse(e?.message);
    return res.json({ error });
  } catch (err) {
    return res.json({ error: e?.message });
  }
};
