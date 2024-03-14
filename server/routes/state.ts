import { Router } from 'express';

const router = Router();

/*
  All routes in this file begin with /state
*/

router.post('/', async (req, res) => {
  try {
    if (!Object.keys(req.body).includes('status'))
      return res.json({ error: 'Missing required fields in request body.', required: ['status'] });

    const valid_status = ['operational', 'degraded', 'maintenance', 'offline'];
    if (!valid_status.includes(req.body.status as string)) {
      return res.json({
        error: 'An invalid status was provided. Please use one from the list provided.',
        valid_status,
      });
    }

    req.app.locals.state.status = req.body.status;
    if (req.body?.notice) req.app.locals.state.notice = req.body.notice;
    else req.app.locals.state.notice = null;

    return res.json({ success: true, state: req.app.locals.state });
  } catch (e) {
    return { success: false, error: e?.message || 'An unexpected error occured. Please try again.' };
  }
});

router.get('/', async (req, res) => {
  return res.json(req.app.locals.state);
});

export default router;
