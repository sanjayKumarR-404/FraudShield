import { Router } from 'express';
import { testAlert, getAlertStatus } from '../controllers/alert.controller.js';
import { authGuard } from '../middleware/auth.middleware.js';

const router = Router();

router.use(authGuard);

router.post('/test', testAlert);
router.get('/status/:transactionId', getAlertStatus);

export default router;
