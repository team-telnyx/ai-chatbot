import hcaptcha from 'express-hcaptcha';
import jwt from 'jsonwebtoken';

import { hCaptchaError, webTokenInvalid, webTokenMissing } from '../errors';
import { Response } from 'express';
import { CallbackEvent } from '../../services/types';

const HCAPTCHA_SECRET = process.env.HCAPTCHA_SECRET_KEY;

export const hCaptcha = (req, res, next) => {
  const token = req.query.token || req.body.token;
  if (!req.body.token) req.body.token = token;

  hcaptcha.middleware.validate(HCAPTCHA_SECRET)(req, res, (err) => {
    if (err) {
      const error = hCaptchaError();
      return res.status(400).json({ error });
    } else {
      next();
    }
  });
};

export const webTokenValidation = (req, res, next) => {
  const http = req.query.http !== undefined;
  const token = req.header('Authorization') || req.query.token || req.body.token;

  if (!http) res.setHeader('Content-Type', 'text/event-stream');

  if (!token) {
    const error = webTokenMissing();
    if (http) return res.status(401).json({ error });

    callback(res, { type: 'error', value: error });
    return res.end();
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    const error = webTokenInvalid(err?.expiredAt);
    if (http) return res.status(401).json({ error });

    callback(res, { type: 'error', value: error });
    return res.end();
  }
};

const callback = (res: Response, event: CallbackEvent): void => {
  res.write('data: ' + JSON.stringify(event) + '\n\n');
};
