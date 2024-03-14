import dotenv from 'dotenv';

import { Router } from 'express';
import { errorMiddleware } from '../libs/app/middleware/error_handler.js';
import { Pricing } from '../libs/repositories/postgres/pricing.postgres.js';

const router = Router();
const pricing = new Pricing();

dotenv.config();

router.get('/model/cost', async (req, res) => {
  try {
    const start = req.query.start_date as string;
    const end = req.query.end_date as string;
    const cost_values = await pricing.getModelCost(start, end);

    return res.json(cost_values);
  } catch (e) {
    errorMiddleware(e, res);
  }
});

router.get('/model', async (req, res) => {
  try {
    const model = req.query.model as string;
    const model_pricing = pricing.getModelPricing(model);

    return res.json(model_pricing);
  } catch (e) {
    errorMiddleware(e, res);
  }
});

export default router;
