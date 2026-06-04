import { Router } from 'express';
import { advance, getByTransaction, getAll } from '../controllers/recovery.controller.js';
import { authGuard } from '../middleware/auth.middleware.js';
import {
    uploadEvidence, generateFIR, generateComplaintLetters,
    updateFIRStatus, markResolved, getRecoveryCaseById
} from '../services/recovery.service.js';
import prisma from '../services/prisma.service.js';
import { Response } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import fs from 'fs';
import multer from 'multer';
import path from 'path';

const router = Router();
router.use(authGuard);

// ── Multer config for evidence uploads ──────────────────────
const evidenceStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        const dir = path.join(process.cwd(), 'uploads', 'evidence');
        fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `evidence_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: evidenceStorage, limits: { fileSize: 10 * 1024 * 1024 } });

// ── Existing routes (Phase 18 & prior) ─────────────────────
router.post('/initiate', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const {
            transactionId,
            complainantName,
            complainantEmail,
            complainantPhone,
            bankName,
            accountNumber,
            description
        } = req.body;

        // Validate all required fields
        if (!transactionId || !complainantName || !complainantEmail || !complainantPhone) {
            res.status(400).json({
                error: 'Missing required fields: transactionId, complainantName, complainantEmail, complainantPhone'
            });
            return;
        }

        // Verify transaction exists
        const transaction = await prisma.transaction.findUnique({
            where: { id: transactionId }
        });

        if (!transaction) {
            res.status(404).json({ error: 'Transaction not found' });
            return;
        }

        // Create recovery case with correct field names
        const recoveryCase = await prisma.recoveryCase.create({
            data: {
                transactionId,
                complainantName,
                complainantEmail,
                complainantPhone: complainantPhone || '',
                bankName: bankName || '',
                accountNumber: accountNumber || '',
                description: description || '',
                status: 'INITIATED',
                initiatedAt: new Date(),
                estimatedResolutionAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
                updatedAt: new Date()
            }
        });

        res.json({
            success: true,
            id: recoveryCase.id,
            caseId: recoveryCase.id,
            message: 'Recovery case initiated successfully'
        });
    } catch (error) {
        console.error('Recovery initiation error:', error);
        res.status(500).json({
            error: 'Failed to initiate recovery',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.patch('/:caseId/advance', advance);
router.get('/transaction/:transactionId', getByTransaction);
router.get('/', getAll);

// ── PDF download (existing) ─────────────────────────────────
router.get('/:caseId/pdf', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseId = req.params.caseId as string;
        const recoveryCase = await prisma.recoveryCase.findUnique({ where: { id: caseId } });

        if (!recoveryCase || !recoveryCase.pdfPath) {
            res.status(404).json({ success: false, message: 'PDF not found' });
            return;
        }
        if (!fs.existsSync(recoveryCase.pdfPath)) {
            res.status(404).json({ success: false, message: 'PDF file missing from disk' });
            return;
        }
        res.download(recoveryCase.pdfPath, `recovery_case_${caseId}.pdf`, (err) => {
            if (err) console.error('Recovery PDF download failed', err);
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Failed to download PDF' });
    }
});

// ── Phase 19: Get single case ───────────────────────────────
router.get('/:caseId', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const data = await getRecoveryCaseById(req.params.caseId as string);
        if (!data) {
            res.status(404).json({ success: false, message: 'Case not found' });
            return;
        }
        res.json({ success: true, data });
    } catch (e) {
        console.error(e);
        res.status(500).json({ success: false, message: 'Failed to fetch case' });
    }
});

// ── Phase 19: Upload evidence ───────────────────────────────
router.post('/:caseId/upload-evidence', upload.single('file'), async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseId = req.params.caseId as string;
        const fileType = req.body.fileType as 'SCREENSHOT' | 'BANK_STATEMENT' | 'CHAT_HISTORY';
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded' });
            return;
        }
        if (!['SCREENSHOT', 'BANK_STATEMENT', 'CHAT_HISTORY'].includes(fileType)) {
            res.status(400).json({ success: false, message: 'Invalid fileType' });
            return;
        }
        await uploadEvidence(caseId, req.file.path, fileType);
        const updated = await getRecoveryCaseById(caseId);
        res.json({ success: true, data: { caseId, evidenceCount: updated?.evidenceUploads.length || 0 } });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Phase 19: Generate FIR PDF ──────────────────────────────
router.get('/:caseId/fir', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseId = req.params.caseId as string;
        const firPath = await generateFIR(caseId);
        if (!fs.existsSync(firPath)) {
            res.status(500).json({ success: false, message: 'FIR generation failed' });
            return;
        }
        res.download(firPath, `FIR_${caseId}.pdf`, (err) => {
            if (err) console.error('FIR download error', err);
        });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Phase 19: Generate complaint letters ────────────────────
router.get('/:caseId/complaint-letters', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const caseId = req.params.caseId as string;
        const { firPath, bankPath } = await generateComplaintLetters(caseId);
        // Return paths as JSON since we can't stream two PDFs at once
        res.json({
            success: true,
            data: {
                firComplaint: `/api/recovery/${caseId}/fir`,
                bankComplaint: `/api/recovery/${caseId}/bank-complaint`,
                firPdfPath: firPath,
                bankPdfPath: bankPath
            }
        });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Phase 19: Update FIR status ─────────────────────────────
router.patch('/:caseId/fir-status', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { status, firNumber, policeStation } = req.body;
        const updated = await updateFIRStatus(req.params.caseId as string, status, firNumber, policeStation);
        res.json({ success: true, data: updated });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ success: false, message: e.message });
    }
});

// ── Phase 19: Mark resolved ─────────────────────────────────
router.patch('/:caseId/resolve', async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { recoveryAmount, recoveryDate } = req.body;
        const updated = await markResolved(
            req.params.caseId as string,
            Number(recoveryAmount),
            new Date(recoveryDate)
        );
        res.json({ success: true, data: updated });
    } catch (e: any) {
        console.error(e);
        res.status(500).json({ success: false, message: e.message });
    }
});

export default router;