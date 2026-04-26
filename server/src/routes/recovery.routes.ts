import { Router } from 'express';
import { initiate, advance, getByTransaction, getAll } from '../controllers/recovery.controller.js';
import { authGuard } from '../middleware/auth.middleware.js';

const router = Router();

// Protect all routes down this tree natively via our global Express router layer
router.use(authGuard);

router.post('/initiate', initiate);
router.patch('/:caseId/advance', advance);
router.get('/transaction/:transactionId', getByTransaction);
router.get('/', getAll);

export default router;
