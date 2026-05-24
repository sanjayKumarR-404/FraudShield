import { Router } from 'express';
import { initiate, advance, getByTransaction, getAll } from '../controllers/recovery.controller.js';
import { authGuard } from '../middleware/auth.middleware.js';
import prisma from '../services/prisma.service.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import fs from 'fs';

const router = Router();

router.use(authGuard);

router.post('/initiate', initiate);
router.patch('/:caseId/advance', advance);
router.get('/transaction/:transactionId', getByTransaction);
router.get('/', getAll);

router.get('/:caseId/pdf', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseId = req.params.caseId as string;
        const recoveryCase = await prisma.recoveryCase.findUnique({
            where: { id: caseId }
        });

        if (!recoveryCase || !recoveryCase.pdfPath) {
            res.status(404).json({ success: false, message: "PDF not found" });
            return;
        }

        if (!fs.existsSync(recoveryCase.pdfPath)) {
            res.status(404).json({ success: false, message: "PDF file missing from disk" });
            return;
        }

        res.download(recoveryCase.pdfPath, `recovery_case_${caseId}.pdf`, (err) => {
            if (err) console.error("Recovery PDF download failed", err);
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: "Failed to download PDF" });
    }
});

export default router;